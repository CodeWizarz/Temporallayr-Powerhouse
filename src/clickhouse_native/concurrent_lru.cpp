#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <mutex>
#include <unordered_map>
#include <list>
#include <string>

// A simplified concurrent LRU Cache based on ClickHouse's LRUResourceCache
class ConcurrentLRUCache {
    using Key = std::string;
    using Value = PyObject*;
    
    struct Cell {
        Value value;
        std::list<Key>::iterator queue_iterator;
    };

    std::mutex mutex;
    std::unordered_map<Key, Cell> cells;
    std::list<Key> queue;
    size_t max_element_size;

public:
    explicit ConcurrentLRUCache(size_t max_size_ = 1000) : max_element_size(max_size_) {}

    ~ConcurrentLRUCache() {
        std::lock_guard<std::mutex> lock(mutex);
        for (auto& pair : cells) {
            Py_XDECREF(pair.second.value);
        }
    }

    Value get(const Key& key) {
        std::lock_guard<std::mutex> lock(mutex);
        auto it = cells.find(key);
        if (it == cells.end()) {
            return nullptr;
        }
        
        // Move to back (most recently used)
        queue.splice(queue.end(), queue, it->second.queue_iterator);
        Py_XINCREF(it->second.value);
        return it->second.value;
    }

    void set(const Key& key, Value val) {
        std::lock_guard<std::mutex> lock(mutex);
        auto it = cells.find(key);
        if (it != cells.end()) {
            Py_XDECREF(it->second.value);
            it->second.value = val;
            Py_XINCREF(val);
            queue.splice(queue.end(), queue, it->second.queue_iterator);
        } else {
            if (cells.size() >= max_element_size) {
                // Evict oldest (front of queue)
                Key oldest_key = queue.front();
                queue.pop_front();
                auto cell_it = cells.find(oldest_key);
                if (cell_it != cells.end()) {
                    Py_XDECREF(cell_it->second.value);
                    cells.erase(cell_it);
                }
            }
            Py_XINCREF(val);
            auto queue_it = queue.insert(queue.end(), key);
            cells[key] = {val, queue_it};
        }
    }
};

// Python wrapper class
typedef struct {
    PyObject_HEAD
    ConcurrentLRUCache* cache;
} PyConcurrentLRU;

static void PyConcurrentLRU_dealloc(PyConcurrentLRU* self) {
    if (self->cache) {
        delete self->cache;
    }
    Py_TYPE(self)->tp_free((PyObject*)self);
}

static PyObject* PyConcurrentLRU_new(PyTypeObject* type, PyObject* args, PyObject* kwds) {
    PyConcurrentLRU* self = (PyConcurrentLRU*)type->tp_alloc(type, 0);
    if (self != NULL) {
        self->cache = nullptr;
    }
    return (PyObject*)self;
}

static int PyConcurrentLRU_init(PyConcurrentLRU* self, PyObject* args, PyObject* kwds) {
    int max_size = 1000;
    static char* kwlist[] = {(char*)"max_size", NULL};

    if (!PyArg_ParseTupleAndKeywords(args, kwds, "|i", kwlist, &max_size))
        return -1;

    self->cache = new ConcurrentLRUCache((size_t)max_size);
    return 0;
}

static PyObject* PyConcurrentLRU_get(PyConcurrentLRU* self, PyObject* args) {
    const char* key;
    if (!PyArg_ParseTuple(args, "s", &key)) return NULL;

    PyObject* val = self->cache->get(std::string(key));
    if (val) {
        return val;
    }
    Py_RETURN_NONE;
}

static PyObject* PyConcurrentLRU_set(PyConcurrentLRU* self, PyObject* args) {
    const char* key;
    PyObject* val;
    if (!PyArg_ParseTuple(args, "sO", &key, &val)) return NULL;

    self->cache->set(std::string(key), val);
    Py_RETURN_NONE;
}

static PyMethodDef PyConcurrentLRU_methods[] = {
    {"get", (PyCFunction)PyConcurrentLRU_get, METH_VARARGS, "Get value from cache"},
    {"set", (PyCFunction)PyConcurrentLRU_set, METH_VARARGS, "Set value in cache"},
    {NULL}
};

static PyTypeObject PyConcurrentLRUType = {
    PyVarObject_HEAD_INIT(NULL, 0)
    .tp_name = "temporallayr_lru_ext.ConcurrentLRU",
    .tp_basicsize = sizeof(PyConcurrentLRU),
    .tp_itemsize = 0,
    .tp_dealloc = (destructor)PyConcurrentLRU_dealloc,
    .tp_flags = Py_TPFLAGS_DEFAULT,
    .tp_doc = "Concurrent LRU Cache Objects",
    .tp_methods = PyConcurrentLRU_methods,
    .tp_init = (initproc)PyConcurrentLRU_init,
    .tp_new = PyConcurrentLRU_new,
};

static struct PyModuleDef lrumodule = {
    PyModuleDef_HEAD_INIT,
    "temporallayr_lru_ext",
    "Temporallayr Concurrent LRU Cache (Adapted from ClickHouse)",
    -1,
    NULL
};

PyMODINIT_FUNC PyInit_temporallayr_lru_ext(void) {
    PyObject* m;
    if (PyType_Ready(&PyConcurrentLRUType) < 0) return NULL;

    m = PyModule_Create(&lrumodule);
    if (m == NULL) return NULL;

    Py_INCREF(&PyConcurrentLRUType);
    if (PyModule_AddObject(m, "ConcurrentLRU", (PyObject*)&PyConcurrentLRUType) < 0) {
        Py_DECREF(&PyConcurrentLRUType);
        Py_DECREF(m);
        return NULL;
    }

    return m;
}
