#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <vector>
#include <cmath>
#include <mutex>
#include <cstdint>
#include <algorithm>
#include <iostream>

#ifdef _MSC_VER
#include <intrin.h>
static inline int ctzll(unsigned long long x) {
    unsigned long index;
    if (_BitScanForward64(&index, x)) return index;
    return 64;
}
#else
static inline int ctzll(unsigned long long x) {
    if (x == 0) return 64;
    return __builtin_ctzll(x);
}
#endif

// Adapted from ClickHouse's HyperLogLogCounter.h
// Extremely fast distinct counting with tiny memory bounds
class HyperLogLog {
    static constexpr uint8_t precision = 12; // 4096 buckets
    static constexpr size_t num_buckets = 1ULL << precision;
    
    std::vector<uint8_t> buckets_;
    std::mutex mutex_;

    // Standard Murmur3 or SipHash would go here. 
    // We assume the caller hashes the string first, or we provide a fast string hash.
    uint64_t hash_string(const std::string& str) {
        uint64_t hash = 5381;
        for (char c : str) {
            hash = ((hash << 5) + hash) + c;
        }
        return hash;
    }

public:
    HyperLogLog() : buckets_(num_buckets, 0) {}

    void add(const std::string& value) {
        uint64_t hash = hash_string(value);
        size_t bucket = hash >> (64 - precision);
        uint8_t rank = static_cast<uint8_t>(ctzll((hash << precision) | (1ULL << (precision - 1))) + 1);
        
        std::lock_guard<std::mutex> lock(mutex_);
        if (rank > buckets_[bucket]) {
            buckets_[bucket] = rank;
        }
    }

    double count() {
        std::lock_guard<std::mutex> lock(mutex_);
        
        double sum = 0.0;
        int zeros = 0;
        for (uint8_t val : buckets_) {
            sum += 1.0 / (1ULL << val);
            if (val == 0) zeros++;
        }
        
        double alpha = 0.7213 / (1.0 + 1.079 / num_buckets);
        double estimate = alpha * num_buckets * num_buckets / sum;
        
        // Linear Counting correction for small estimates
        if (estimate <= 2.5 * num_buckets && zeros > 0) {
            estimate = num_buckets * std::log(static_cast<double>(num_buckets) / zeros);
        }
        
        return estimate;
    }
};

typedef struct {
    PyObject_HEAD
    HyperLogLog* hll;
} PyHyperLogLog;

static void PyHyperLogLog_dealloc(PyHyperLogLog* self) {
    delete self->hll;
    Py_TYPE(self)->tp_free((PyObject*)self);
}

static PyObject* PyHyperLogLog_new(PyTypeObject* type, PyObject* args, PyObject* kwds) {
    PyHyperLogLog* self = (PyHyperLogLog*)type->tp_alloc(type, 0);
    if (self != NULL) {
        self->hll = new HyperLogLog();
    }
    return (PyObject*)self;
}

static int PyHyperLogLog_init(PyHyperLogLog* self, PyObject* args, PyObject* kwds) {
    return 0;
}

static PyObject* PyHyperLogLog_add(PyHyperLogLog* self, PyObject* args) {
    const char* value;
    if (!PyArg_ParseTuple(args, "s", &value)) return NULL;
    self->hll->add(value);
    Py_RETURN_NONE;
}

static PyObject* PyHyperLogLog_count(PyHyperLogLog* self, PyObject* args) {
    double est = self->hll->count();
    return PyFloat_FromDouble(est);
}

static PyMethodDef PyHyperLogLog_methods[] = {
    {"add", (PyCFunction)PyHyperLogLog_add, METH_VARARGS, "Add value"},
    {"count", (PyCFunction)PyHyperLogLog_count, METH_NOARGS, "Estimate distinct count"},
    {NULL}
};

static PyTypeObject PyHyperLogLogType = {
    PyVarObject_HEAD_INIT(NULL, 0)
    .tp_name = "temporallayr_hll_ext.HyperLogLog",
    .tp_basicsize = sizeof(PyHyperLogLog),
    .tp_itemsize = 0,
    .tp_dealloc = (destructor)PyHyperLogLog_dealloc,
    .tp_flags = Py_TPFLAGS_DEFAULT,
    .tp_doc = "HyperLogLog Distinct Count",
    .tp_methods = PyHyperLogLog_methods,
    .tp_init = (initproc)PyHyperLogLog_init,
    .tp_new = PyHyperLogLog_new,
};

static struct PyModuleDef hllmodule = {
    PyModuleDef_HEAD_INIT,
    "temporallayr_hll_ext",
    "HyperLogLog Extension",
    -1,
    NULL
};

PyMODINIT_FUNC PyInit_temporallayr_hll_ext(void) {
    PyObject* m;
    if (PyType_Ready(&PyHyperLogLogType) < 0) return NULL;
    m = PyModule_Create(&hllmodule);
    if (m == NULL) return NULL;
    Py_INCREF(&PyHyperLogLogType);
    PyModule_AddObject(m, "HyperLogLog", (PyObject*)&PyHyperLogLogType);
    return m;
}
