#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <bit>

using UInt64 = uint64_t;
using UInt8 = uint8_t;
#define ALWAYS_INLINE inline

#define SIPROUND                                                  \
    do                                                            \
    {                                                             \
        v0 += v1; v1 = std::rotl(v1, 13); v1 ^= v0; v0 = std::rotl(v0, 32); \
        v2 += v3; v3 = std::rotl(v3, 16); v3 ^= v2;                    \
        v0 += v3; v3 = std::rotl(v3, 21); v3 ^= v0;                    \
        v2 += v1; v1 = std::rotl(v1, 17); v1 ^= v2; v2 = std::rotl(v2, 32); \
    } while(0)

#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
#define CURRENT_BYTES_IDX(i) (7 - i)
#else
#define CURRENT_BYTES_IDX(i) (i)
#endif

/// Adapted from ClickHouse src/Common/SipHash.h
class SipHash
{
private:
    UInt64 v0;
    UInt64 v1;
    UInt64 v2;
    UInt64 v3;
    UInt64 cnt;

    union
    {
        UInt64 current_word;
        UInt8 current_bytes[8];
    };

    ALWAYS_INLINE void finalize()
    {
        current_bytes[CURRENT_BYTES_IDX(7)] = static_cast<UInt8>(cnt);

        v3 ^= current_word;
        SIPROUND;
        SIPROUND;
        v0 ^= current_word;

        v2 ^= 0xff;
        SIPROUND;
        SIPROUND;
        SIPROUND;
        SIPROUND;
    }

public:
    SipHash(UInt64 key0 = 0, UInt64 key1 = 0)
    {
        v0 = 0x736f6d6570736575ULL ^ key0;
        v1 = 0x646f72616e646f6dULL ^ key1;
        v2 = 0x6c7967656e657261ULL ^ key0;
        v3 = 0x7465646279746573ULL ^ key1;
        cnt = 0;
        current_word = 0;
    }

    ALWAYS_INLINE void update(const char * data, UInt64 size)
    {
        const char * end = data + size;

        if (cnt & 7)
        {
            while (cnt & 7 && data < end)
            {
                current_bytes[CURRENT_BYTES_IDX(cnt & 7)] = *data;
                ++data;
                ++cnt;
            }
            if (cnt & 7) return;

            v3 ^= current_word;
            SIPROUND;
            SIPROUND;
            v0 ^= current_word;
        }

        cnt += end - data;

        while (data + 8 <= end)
        {
            // Assuming little endian for x86/arm in modern environments
            current_word = *reinterpret_cast<const UInt64*>(data);

            v3 ^= current_word;
            SIPROUND;
            SIPROUND;
            v0 ^= current_word;

            data += 8;
        }

        current_word = 0;
        switch (end - data)
        {
            case 7: current_bytes[CURRENT_BYTES_IDX(6)] = data[6]; [[fallthrough]];
            case 6: current_bytes[CURRENT_BYTES_IDX(5)] = data[5]; [[fallthrough]];
            case 5: current_bytes[CURRENT_BYTES_IDX(4)] = data[4]; [[fallthrough]];
            case 4: current_bytes[CURRENT_BYTES_IDX(3)] = data[3]; [[fallthrough]];
            case 3: current_bytes[CURRENT_BYTES_IDX(2)] = data[2]; [[fallthrough]];
            case 2: current_bytes[CURRENT_BYTES_IDX(1)] = data[1]; [[fallthrough]];
            case 1: current_bytes[CURRENT_BYTES_IDX(0)] = data[0]; [[fallthrough]];
            case 0: break;
        }
    }

    ALWAYS_INLINE UInt64 get64()
    {
        finalize();
        return v0 ^ v1 ^ v2 ^ v3;
    }
};

inline UInt64 sipHash64(const char * data, const size_t size)
{
    SipHash hash(0, 0);
    hash.update(data, size);
    return hash.get64();
}
