#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <cstdint>

// Standard Jump Consistent Hashing Algorithm used in distributed systems
// (Used to distribute traces deterministically across backend shards)
static int32_t JumpConsistentHash(uint64_t key, int32_t num_buckets) {
    int64_t b = -1, j = 0;
    while (j < num_buckets) {
        b = j;
        key = key * 2862933555777941757ULL + 1;
        j = (b + 1) * (double(1LL << 31) / double((key >> 33) + 1));
    }
    return b;
}

static PyObject* py_get_shard(PyObject* self, PyObject* args) {
    unsigned long long key;
    int num_buckets;

    if (!PyArg_ParseTuple(args, "Ki", &key, &num_buckets)) {
        return NULL;
    }

    if (num_buckets <= 0) {
        PyErr_SetString(PyExc_ValueError, "Number of buckets must be greater than 0");
        return NULL;
    }

    int32_t shard = JumpConsistentHash((uint64_t)key, num_buckets);
    return PyLong_FromLong(shard);
}

static PyMethodDef TemporallayrShardMethods[] = {
    {"get_shard", py_get_shard, METH_VARARGS, "Compute Jump Consistent Hash for shard designation."},
    {NULL, NULL, 0, NULL}
};

static struct PyModuleDef shardmodule = {
    PyModuleDef_HEAD_INIT,
    "temporallayr_shard_ext",
    "Temporallayr Hash Sharding (Jump Consistent Hashing)",
    -1,
    TemporallayrShardMethods
};

PyMODINIT_FUNC PyInit_temporallayr_shard_ext(void) {
    return PyModule_Create(&shardmodule);
}
