#!/usr/bin/env python3
import argparse
import sys

# Ordered by likelihood of bypassing bot detection — newest Chrome first.
# Tesco IE uses Akamai Bot Manager; Dunnes uses Cloudflare.
IMPERSONATION_PROFILES = {
    "tesco":  ["chrome131", "chrome124", "chrome123", "chrome120", "safari18_0", "safari17_2"],
    "dunnes": ["chrome131", "chrome124", "safari18_0", "safari17_2", "chrome123", "chrome120"],
}

# Headers that Chrome 131 sends on a fresh navigation (no referrer, direct URL).
CHROME_HEADERS = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "en-IE,en-GB;q=0.9,en;q=0.8",
    "accept-encoding": "gzip, deflate, br",
    "cache-control": "max-age=0",
    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
}


def looks_blocked(store: str, html: str) -> bool:
    lowered = html.lower()
    if store == "tesco":
        return (
            "access denied" in lowered
            or "you have been blocked" in lowered
            or ("</html>" not in lowered and len(html) < 2000)
        )
    # Dunnes uses Cloudflare
    return "just a moment" in lowered or "security verification" in lowered or "cf-browser-verification" in lowered


def main() -> int:
    try:
        from curl_cffi import requests
    except Exception as exc:  # pragma: no cover - optional dependency on some arches
        sys.stderr.write(f"curl_cffi unavailable: {exc}")
        return 1

    parser = argparse.ArgumentParser()
    parser.add_argument("--store", required=True, choices=["tesco", "dunnes"])
    parser.add_argument("--url", required=True)
    args = parser.parse_args()

    profiles = IMPERSONATION_PROFILES[args.store]
    last_error = None

    for profile in profiles:
        try:
            response = requests.get(
                args.url,
                impersonate=profile,
                headers=CHROME_HEADERS,
                timeout=30,
                allow_redirects=True,
            )
            html = response.text or ""

            if response.status_code == 200 and not looks_blocked(args.store, html):
                sys.stdout.write(html)
                return 0

            last_error = f"{profile}: HTTP {response.status_code}"
        except Exception as exc:  # pragma: no cover - defensive runtime fallback
            last_error = f"{profile}: {exc}"

    sys.stderr.write(last_error or "All profiles failed")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
