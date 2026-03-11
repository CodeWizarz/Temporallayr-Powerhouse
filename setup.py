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

temporallayr_spacesaving_ext = Extension(
    "temporallayr_spacesaving_ext",
    sources=["src/clickhouse_native/space_saving.cpp"],
    language="c++",
    extra_compile_args=args,
)

temporallayr_hll_ext = Extension(
    "temporallayr_hll_ext",
    sources=["src/clickhouse_native/hll_counter.cpp"],
    language="c++",
    extra_compile_args=args,
)

temporallayr_pool_ext = Extension(
    "temporallayr_pool_ext",
    sources=["src/clickhouse_native/fast_threadpool.cpp"],
    language="c++",
    extra_compile_args=args,
)

setup(
    name="temporallayr",
    version="0.1.0",
    ext_modules=[
        temporallayr_hash_ext,
        temporallayr_lru_ext,
        temporallayr_shard_ext,
        temporallayr_spacesaving_ext,
        temporallayr_hll_ext,
        temporallayr_pool_ext,
    ],
)
