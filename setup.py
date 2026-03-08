from setuptools import setup, Extension

temporallayr_hash_ext = Extension(
    "temporallayr_hash_ext",
    sources=["src/clickhouse_native/temporallayr_hash_ext.cpp"],
    language="c++",
    extra_compile_args=["-std=c++20", "-O3"]
    if not __import__("os").name == "nt"
    else ["/std:c++20", "/O2"],
)

setup(
    name="temporallayr",
    version="0.1.0",
    ext_modules=[temporallayr_hash_ext],
)
