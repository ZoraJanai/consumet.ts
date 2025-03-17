import * as cheerio from "cheerio";

type Resolution = "360p" | "480p" | "720p" | "1080p";

// Add type guard
const isValidResolution = (quality: string): quality is Resolution => {
  return ["360p", "480p", "720p", "1080p"].includes(quality);
};

export async function parseVideoData(html: string) {
  const $ = cheerio.load(html);
  const result: {
    sub: Record<Resolution, { src?: string; download?: string }>;
    dub?: Record<Resolution, { src?: string; download?: string }>; // Make dub optional
  } = {
    sub: {
      "360p": {},
      "480p": {},
      "720p": {},
      "1080p": {},
    },
    dub: {
      "360p": {},
      "480p": {},
      "720p": {},
      "1080p": {},
    },
  };

  // Parse video sources
  const promises = $("#resolutionMenu button")
    .map(async (_, button) => {
      const src = $(button).attr("data-src") || "";
      const fansub = $(button).attr("data-fansub") || "";
      const resolution = $(button).attr("data-resolution") || "";
      const audio = $(button).attr("data-audio") || "";
      const quality = `${resolution}p` as Resolution;

      if (!isValidResolution(quality) || !src) return;

      // Find the corresponding download link
      const downloadLink =
        $(`#pickDownload a`)
          .filter((_, a) => {
            const text = $(a).text();
            return (
              text.includes(fansub) &&
              text.includes(quality) &&
              (audio === "jpn" ? !text.includes("eng") : text.includes("eng"))
            );
          })
          .attr("href") || "";

      const m3u8Link = await fetchm3u8(src);
      if (!m3u8Link) return;

      // Assign to sub or dub based on audio
      if (audio === "jpn") {
        result.sub[quality] = { src: m3u8Link, download: downloadLink };
      } else if (audio === "eng") {
        if (!result.dub) {
          result.dub = {
            "360p": {},
            "480p": {},
            "720p": {},
            "1080p": {},
          };
        }
        result.dub[quality] = { src: m3u8Link, download: downloadLink };
      }
    })
    .get();

  await Promise.all(promises);

  // Remove dub object if it has no entries
  if (result.dub && Object.keys(result.dub).length === 0) {
    delete result.dub;
  }
  return result;
}

const fetchm3u8 = async (url: string): Promise<string | null> => {
  const referer = "https://animepahe.ru/";
  try {
    const response = await fetch(url, {
      headers: {
        Referer: referer,
      },
    });
    const text = await response.text();

    //@ts-ignore
    const match = /(eval)(\(function[\s\S]*?)(<\/script>)/s.exec(text);
    if (match && match[2]) {
      // Evaluate the code to retrieve the m3u8 link
      const link = eval(match[2].replace("eval", "")).match(/https.*?m3u8/);
      return link ? link[0] : null;
    }
  } catch (error) {
    console.error("Error fetching m3u8 link:", error);
  }
  return null;
};

// Adjust interface(s) as needed
interface EpisodeData {
  episode?: number;
  // Include other fields if your data requires them
}

// 1) Fetch Pahe data (search)
export const fetchPaheData = async (title: string) => {
  const url = `https://animepahe.ru/api?m=search&q=${title}`;

  try {
    // Native fetch call
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.7",
        Cookie:
          "__ddgid_=OTcqdThY3SqrpMKJ; __ddg2_=hYARCDSHUTVXcLWW; __ddg1_=axxddcKnDXN08jslc2Lo; __ddg9_=1.187.213.32; SERVERID=janna; XSRF-TOKEN=eyJpdiI6IjM4V2pYVVhyblQrN2JyVGRheWdyaFE9PSIsInZhbHVlIjoiT1FIUWNCc0FYbHlRZklGN1hNT0hEYi93NkhSVk5kczRadG5uREMyZUpMMVpzbVd2ZjBOTDNCL2FaaGdYMWdrZ1BUU3pXbm83ODFIWTNXdEdZZnQ2ZHQ0OEhyWldud2R6UHBvZHVOTDRZRmRRQ3ZScGdQdnhURkoyZmJQbURvVE8iLCJtYWMiOiJkMzc1YzZmZjA2ZjlkNzE2ZDk3YzViMDNjZDU3MWM3NDg3MjJiZjExMDk5Y2NhMTk2ODI5YzFmY2I3MGY2ZDg5IiwidGFnIjoiIn0%3D; laravel_session=eyJpdiI6IkJsekRaWXI3dzNFT0dHeDFnRnNKK0E9PSIsInZhbHVlIjoiYWpLK2w4ZGcxQnBoWFBHMmpFNW0wYUNUZ2dUTzBHRU1XT3ZMNk4wSGFpcHpvSkJxVjZJZ0pMSWU4TDVFR21janJnQ1Rxb1Z3RHdtVnU5Q2o1KzJWdldwQ3RsalQrdjVlQy9ReXZaYkxIS2l2YkdMM212VXhSSDd5TDFlZG52YmQiLCJtYWMiOiI4YjExYmM3MDEyOThjOTljYmY1ODZlNDkxNjA3NTlkM2E1MjE2NjViNWY3NDI3ZDJmYjJkNWFiYzRiZTE3MGU3IiwidGFnIjoiIn0%3D; aud=jpn; av1=0; res=480; __ddg8_=wtlPa91Y19rbRx0q; __ddg10_=1736137232",
        Referer: "https://animepahe.ru/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!response.ok) {
      console.error(`Fetch error: ${response.status} - ${response.statusText}`);
      return;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

// 2) Fetch Pahe episode data (paginated)
export const fetchPaheEpisodeData = async (paheId: string) => {
  const baseUrl = `https://animepahe.ru/api?m=release&id=${paheId}&sort=episode_asc&page=`;
  let allData: EpisodeData[] = [];
  let currentPage = 1;
  let totalPages = 1;

  try {
    do {
      // Native fetch call
      const response = await fetch(`${baseUrl}${currentPage}`, {
        method: "GET",
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Accept-Language": "en-US,en;q=0.7",
          Cookie:
            "__ddgid_=OTcqdThY3SqrpMKJ; __ddg2_=hYARCDSHUTVXcLWW; __ddg1_=axxddcKnDXN08jslc2Lo; SERVERID=janna; aud=jpn; av1=0; res=480; __ddg9_=1.187.213.32; __ddg8_=iHsLQcFXaCxEJoZY; __ddg10_=1736140677; XSRF-TOKEN=eyJpdiI6IjlsRHBLNjB4elpwaVc3bEdKMDl5L1E9PSIsInZhbHVlIjoiRmkvZzF6Yno2aXVZOE0yQ2ZIM1gvQzh0dkdpeUdQRDdodWVwYlF4UlNYK0RCd09UNEhHRjZ1aFd4WTlkb0piSDRrTkppQlBKYmVncnZjNWZLaUhGQnFNMEE2Y1c4YzBsaFlhVnBiRmhWT0VUNnZhUlA2UUlKMmdaYXQ1REppMkoiLCJtYWMiOiJmMzkyMmQyYThmNDc2Mjk2MGI1NjQxODNlZGUxMGYzMDcwZDc2MmUzODRlMzBiNWRkYjZhOWZhNWEwNzMzYjFkIiwidGFnIjoiIn0%3D; laravel_session=eyJpdiI6IlZaek9BY3JTUmpmR2NyblhvY3pEcUE9PSIsInZhbHVlIjoiY3Ywd1BmU254QVBLeWxHTFdmTmM4Q0VuR3hIZUFPeDAza2pwd1BNdHI3V1hZUVlhbEVFKytBdEV4Z2NpQmpybzFNb0lXa2RPRU1nb2xPQ3huRlRYa2hEZHpINFBVZ2RUMTJsTHhqNnhRWFdUSnAyd2ZDMDQ0R3FJSmVXRUJrSG4iLCJtYWMiOiJlNzQ2ZDc1Mzk5MDkwZjNlYThiOTFkOGZlMTJiN2UxN2VmYjdkNzAxY2E4M2M4ODc1Y2ExMjljNGEwZWY4ZDMyIiwidGFnIjoiIn0%3D",
          Referer: `https://animepahe.ru/anime/${paheId}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        console.error(
          `Fetch error [Episode Data]: ${response.status} - ${response.statusText}`
        );
        break;
      }

      const result = await response.json();
      // Append the current page data to allData
      allData = allData.concat(result.data || []);

      currentPage++;
      totalPages = result.last_page || 1; // Get total number of pages
    } while (currentPage <= totalPages);

    return allData;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

// 3) Fetch Pahe source (HTML page for an episode)
export async function paheSource(id: string) {
  try {
    const response = await fetch(`https://animepahe.ru/play/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.7",
        Cookie:
          "__ddgid_=OTcqdThY3SqrpMKJ; __ddg2_=hYARCDSHUTVXcLWW; __ddg1_=axxddcKnDXN08jslc2Lo; SERVERID=janna; aud=jpn; av1=0; res=480; __ddg9_=1.187.213.32; __ddg8_=iHsLQcFXaCxEJoZY; __ddg10_=1736140677; XSRF-TOKEN=eyJpdiI6IjlsRHBLNjB4elpwaVc3bEdKMDl5L1E9PSIsInZhbHVlIjoiRmkvZzF6Yno2aXVZOE0yQ2ZIM1gvQzh0dkdpeUdQRDdodWVwYlF4UlNYK0RCd09UNEhHRjZ1aFd4WTlkb0piSDRrTkppQlBKYmVncnZjNWZLaUhGQnFNMEE2Y1c4YzBsaFlhVnBiRmhWT0VUNnZhUlA2UUlKMmdaYXQ1REppMkoiLCJtYWMiOiJmMzkyMmQyYThmNDc2Mjk2MGI1NjQxODNlZGUxMGYzMDcwZDc2MmUzODRlMzBiNWRkYjZhOWZhNWEwNzMzYjFkIiwidGFnIjoiIn0%3D; laravel_session=eyJpdiI6IlZaek9BY3JTUmpmR2NyblhvY3pEcUE9PSIsInZhbHVlIjoiY3Ywd1BmU254QVBLeWxHTFdmTmM4Q0VuR3hIZUFPeDAza2pwd1BNdHI3V1hZUVlhbEVFKytBdEV4Z2NpQmpybzFNb0lXa2RPRU1nb2xPQ3huRlRYa2hEZHpINFBVZ2RUMTJsTHhqNnhRWFdUSnAyd2ZDMDQ0R3FJSmVXRUJrSG4iLCJtYWMiOiJlNzQ2ZDc1Mzk5MDkwZjNlYThiOTFkOGZlMTJiN2UxN2VmYjdkNzAxY2E4M2M4ODc1Y2ExMjljNGEwZWY4ZDMyIiwidGFnIjoiIn0%3D",
        Referer: "https://animepahe.ru",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!response.ok) {
      console.error(
        `Fetch error [Pahe Source]: ${response.status} - ${response.statusText}`
      );
      return [];
    }

    // Get the HTML as text
    const htmlData = await response.text();
    // Parse the video data from the HTML
    const parsedVideoData = await parseVideoData(htmlData);
    return parsedVideoData;
  } catch (error) {
    console.error(error);
    return [];
  }
}
