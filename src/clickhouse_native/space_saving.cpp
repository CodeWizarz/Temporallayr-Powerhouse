#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <vector>
#include <unordered_map>
#include <string>
#include <algorithm>
#include <mutex>

// Adapted from ClickHouse's Filtered Space-Saving for Top-K streaming analysis
// https://arxiv.org/pdf/1401.0702.pdf

class SpaceSaving {
    struct Counter {
        std::string key;
        double count;
        double error;

        bool operator>(const Counter& other) const {
            return (count - error) > (other.count - other.error);
        }
    };

    std::mutex mutex_;
    size_t capacity_;
    std::unordered_map<std::string, size_t> key_to_index_;
    std::vector<Counter> counters_;

    void truncate() {
        if (counters_.size() > capacity_ * 2) {
            std::partial_sort(counters_.begin(), counters_.begin() + capacity_, counters_.end(), std::greater<Counter>());
            counters_.resize(capacity_);
            key_to_index_.clear();
            for (size_t i = 0; i < counters_.size(); ++i) {
                key_to_index_[counters_[i].key] = i;
            }
        }
    }

public:
    explicit SpaceSaving(size_t capacity) : capacity_(capacity) {}

    void insert(const std::string& key, double increment = 1.0) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = key_to_index_.find(key);
        if (it != key_to_index_.end()) {
            counters_[it->second].count += increment;
        } else {
            double error = 0;
            if (counters_.size() >= capacity_) {
                // Approximate error based on smallest element (simplified for stream)
                error = counters_.back().count; 
            }
            counters_.push_back({key, increment + error, error});
            key_to_index_[key] = counters_.size() - 1;
            truncate();
        }
    }

    std::vector<std::pair<std::string, double>> topK(size_t k) {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<Counter> sorted_counters = counters_;
        size_t return_size = std::min(sorted_counters.size(), k);
        std::partial_sort(sorted_counters.begin(), sorted_counters.begin() + return_size, sorted_counters.end(), std::greater<Counter>());
        
        std::vector<std::pair<std::string, double>> result;
        for (size_t i = 0; i < return_size; ++i) {
            result.push_back({sorted_counters[i].key, sorted_counters[i].count});
        }
        return result;
    }
};

typedef struct {
    PyObject_HEAD
    SpaceSaving* tracker;
} PySpaceSaving;

static void PySpaceSaving_dealloc(PySpaceSaving* self) {
    delete self->tracker;
    Py_TYPE(self)->tp_free((PyObject*)self);
}

static PyObject* PySpaceSaving_new(PyTypeObject* type, PyObject* args, PyObject* kwds) {
    PySpaceSaving* self = (PySpaceSaving*)type->tp_alloc(type, 0);
    if (self != NULL) {
        self->tracker = nullptr;
    }
    return (PyObject*)self;
}

static int PySpaceSaving_init(PySpaceSaving* self, PyObject* args, PyObject* kwds) {
    size_t capacity = 1000;
    static char* kwlist[] = {(char*)"capacity", NULL};
    if (!PyArg_ParseTupleAndKeywords(args, kwds, "|n", kwlist, &capacity)) return -1;
    self->tracker = new SpaceSaving(capacity);
    return 0;
}

static PyObject* PySpaceSaving_insert(PySpaceSaving* self, PyObject* args) {
    const char* key;
    double increment = 1.0;
    if (!PyArg_ParseTuple(args, "s|d", &key, &increment)) return NULL;
    self->tracker->insert(key, increment);
    Py_RETURN_NONE;
}

static PyObject* PySpaceSaving_top_k(PySpaceSaving* self, PyObject* args) {
    size_t k;
    if (!PyArg_ParseTuple(args, "n", &k)) return NULL;
    auto top = self->tracker->topK(k);
    
    PyObject* list = PyList_New(top.size());
    for (size_t i = 0; i < top.size(); ++i) {
        PyObject* tuple = PyTuple_Pack(2, PyUnicode_FromString(top[i].first.c_str()), PyFloat_FromDouble(top[i].second));
        PyList_SetItem(list, i, tuple);
    }
    return list;
}

static PyMethodDef PySpaceSaving_methods[] = {
    {"insert", (PyCFunction)PySpaceSaving_insert, METH_VARARGS, "Insert key"},
    {"top_k", (PyCFunction)PySpaceSaving_top_k, METH_VARARGS, "Get Top K"},
    {NULL}
};

static PyTypeObject PySpaceSavingType = {
    PyVarObject_HEAD_INIT(NULL, 0)
    .tp_name = "temporallayr_spacesaving_ext.SpaceSaving",
    .tp_basicsize = sizeof(PySpaceSaving),
    .tp_itemsize = 0,
    .tp_dealloc = (destructor)PySpaceSaving_dealloc,
    .tp_flags = Py_TPFLAGS_DEFAULT,
    .tp_doc = "Space Saving Top-K",
    .tp_methods = PySpaceSaving_methods,
    .tp_init = (initproc)PySpaceSaving_init,
    .tp_new = PySpaceSaving_new,
};

static struct PyModuleDef spacesavingmodule = {
    PyModuleDef_HEAD_INIT,
    "temporallayr_spacesaving_ext",
    "Space Saving Heavy Hitters",
    -1,
    NULL
};

PyMODINIT_FUNC PyInit_temporallayr_spacesaving_ext(void) {
    PyObject* m;
    if (PyType_Ready(&PySpaceSavingType) < 0) return NULL;
    m = PyModule_Create(&spacesavingmodule);
    if (m == NULL) return NULL;
    Py_INCREF(&PySpaceSavingType);
    PyModule_AddObject(m, "SpaceSaving", (PyObject*)&PySpaceSavingType);
    return m;
}
