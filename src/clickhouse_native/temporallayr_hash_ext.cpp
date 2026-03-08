#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include "SipHash.h"

static PyObject* py_siphash64(PyObject* self, PyObject* args) {
    const char* data;
    Py_ssize_t size;

    if (!PyArg_ParseTuple(args, "s#", &data, &size)) {
        return NULL;
    }

    uint64_t hash_val = sipHash64(data, (size_t)size);
    return PyLong_FromUnsignedLongLong(hash_val);
}

static PyMethodDef TemporallayrHashMethods[] = {
    {"siphash64", py_siphash64, METH_VARARGS, "Compute ClickHouse SipHash64 for a string or bytes."},
    {NULL, NULL, 0, NULL}
};

static struct PyModuleDef temporallayrhashmodule = {
    PyModuleDef_HEAD_INIT,
    "temporallayr_hash_ext",
    "Temporallayr Native C++ Hash Extensions (Adapted from ClickHouse)",
    -1,
    TemporallayrHashMethods
};

PyMODINIT_FUNC PyInit_temporallayr_hash_ext(void) {
    return PyModule_Create(&temporallayrhashmodule);
}
