from setuptools import Extension, setup

args = ["-std=c++20", "-O3"] if not __import__("os").name == "nt" else ["/std:c++20", "/O2"]

temporallayr_hash_ext = Extension(
    "temporallayr_hash_ext",
    sources=["src/clickhouse_native/temporallayr_hash_ext.cpp"],
    language="c++",
    extra_compile_args=args,
)

temporallayr_lru_ext = Extension(
    "temporallayr_lru_ext",
    sources=["src/clickhouse_native/concurrent_lru.cpp"],
    language="c++",
    extra_compile_args=args,
)

temporallayr_shard_ext = Extension(
    "temporallayr_shard_ext",
    sources=["src/clickhouse_native/consistent_hash.cpp"],
    language="c++",
    extra_compile_args=args,
)

setup(
    name="temporallayr",
    version="0.1.0",
    ext_modules=[temporallayr_hash_ext, temporallayr_lru_ext, temporallayr_shard_ext],
)
