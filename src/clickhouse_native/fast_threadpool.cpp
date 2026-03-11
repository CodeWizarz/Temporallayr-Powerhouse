#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <thread>
#include <vector>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <functional>

// Adapted from ClickHouse's ThreadPool implementation which removes GIL context
// overhead when queuing large batches of tasks.

class NativeThreadPool {
    std::vector<std::thread> workers;
    std::queue<PyObject*> tasks;

    std::mutex queue_mutex;
    std::condition_variable condition;
    bool stop;

public:
    NativeThreadPool(size_t threads) : stop(false) {
        for(size_t i = 0; i < threads; ++i) {
            workers.emplace_back([this] {
                for(;;) {
                    PyObject* task;
                    {
                        std::unique_lock<std::mutex> lock(this->queue_mutex);
                        this->condition.wait(lock, [this]{ return this->stop || !this->tasks.empty(); });
                        if(this->stop && this->tasks.empty()) return;
                        task = this->tasks.front();
                        this->tasks.pop();
                    }

                    // We must acquire GIL to execute the python callable 
                    // However, actual scheduling and queue management runs in C++
                    PyGILState_STATE gstate = PyGILState_Ensure();
                    PyObject* result = PyObject_CallObject(task, NULL);
                    if (result != NULL) {
                        Py_DECREF(result);
                    } else {
                        PyErr_Print();
                    }
                    Py_DECREF(task); // Release our reference to the callable
                    PyGILState_Release(gstate);
                }
            });
        }
    }

    void enqueue(PyObject* callable) {
        {
            std::unique_lock<std::mutex> lock(queue_mutex);
            if(stop) return;
            Py_INCREF(callable);
            tasks.push(callable);
        }
        condition.notify_one();
    }

    ~NativeThreadPool() {
        {
            std::unique_lock<std::mutex> lock(queue_mutex);
            stop = true;
        }
        condition.notify_all();
        for(std::thread &worker: workers) {
            worker.join();
        }
    }
};

typedef struct {
    PyObject_HEAD
    NativeThreadPool* pool;
} PyNativeThreadPool;

static void PyNativeThreadPool_dealloc(PyNativeThreadPool* self) {
    if (self->pool) {
        // Must release GIL while threads join to avoid deadlock if they need GIL
        PyThreadState *_save = PyEval_SaveThread();
        delete self->pool;
        PyEval_RestoreThread(_save);
    }
    Py_TYPE(self)->tp_free((PyObject*)self);
}

static PyObject* PyNativeThreadPool_new(PyTypeObject* type, PyObject* args, PyObject* kwds) {
    PyNativeThreadPool* self = (PyNativeThreadPool*)type->tp_alloc(type, 0);
    if (self != NULL) {
        self->pool = nullptr;
    }
    return (PyObject*)self;
}

static int PyNativeThreadPool_init(PyNativeThreadPool* self, PyObject* args, PyObject* kwds) {
    int threads = 4;
    static char* kwlist[] = {(char*)"threads", NULL};
    if (!PyArg_ParseTupleAndKeywords(args, kwds, "|i", kwlist, &threads)) return -1;
    self->pool = new NativeThreadPool(threads);
    return 0;
}

static PyObject* PyNativeThreadPool_submit(PyNativeThreadPool* self, PyObject* args) {
    PyObject* callable;
    if (!PyArg_ParseTuple(args, "O", &callable)) return NULL;
    
    if (!PyCallable_Check(callable)) {
        PyErr_SetString(PyExc_TypeError, "argument must be callable");
        return NULL;
    }

    self->pool->enqueue(callable);
    Py_RETURN_NONE;
}

static PyMethodDef PyNativeThreadPool_methods[] = {
    {"submit", (PyCFunction)PyNativeThreadPool_submit, METH_VARARGS, "Submit callable"},
    {NULL}
};

static PyTypeObject PyNativeThreadPoolType = {
    PyVarObject_HEAD_INIT(NULL, 0)
    .tp_name = "temporallayr_pool_ext.NativeThreadPool",
    .tp_basicsize = sizeof(PyNativeThreadPool),
    .tp_itemsize = 0,
    .tp_dealloc = (destructor)PyNativeThreadPool_dealloc,
    .tp_flags = Py_TPFLAGS_DEFAULT,
    .tp_doc = "Native Thread Pool",
    .tp_methods = PyNativeThreadPool_methods,
    .tp_init = (initproc)PyNativeThreadPool_init,
    .tp_new = PyNativeThreadPool_new,
};

static struct PyModuleDef poolmodule = {
    PyModuleDef_HEAD_INIT,
    "temporallayr_pool_ext",
    "Native C++ Thread Pool",
    -1,
    NULL
};

PyMODINIT_FUNC PyInit_temporallayr_pool_ext(void) {
    PyObject* m;
    if (PyType_Ready(&PyNativeThreadPoolType) < 0) return NULL;
    m = PyModule_Create(&poolmodule);
    if (m == NULL) return NULL;
    Py_INCREF(&PyNativeThreadPoolType);
    PyModule_AddObject(m, "NativeThreadPool", (PyObject*)&PyNativeThreadPoolType);
    return m;
}
