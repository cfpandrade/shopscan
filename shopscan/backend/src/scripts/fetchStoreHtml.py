#!/usr/bin/env python3
import argparse
import sys

from curl_cffi import requests


IMPERSONATION_PROFILES = {
    "tesco": ["safari17_0", "chrome120", "chrome110", "chrome99"],
    "dunnes": ["safari17_0", "chrome120", "safari18_0", "chrome110"],
}


def looks_blocked(store: str, html: str) -> bool:
    lowered = html.lower()
    if store == "tesco":
        return "access denied" in lowered
    return "just a moment" in lowered or "security verification" in lowered


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", required=True, choices=["tesco", "dunnes"])
    parser.add_argument("--url", required=True)
    args = parser.parse_args()

    profiles = IMPERSONATION_PROFILES[args.store]
    last_error = None

    for profile in profiles:
        try:
            response = requests.get(args.url, impersonate=profile, timeout=30)
            html = response.text or ""

            if response.status_code == 200 and not looks_blocked(args.store, html):
                sys.stdout.write(html)
                return 0

            last_error = f"{profile}: HTTP {response.status_code}"
        except Exception as exc:  # pragma: no cover - defensive runtime fallback
            last_error = f"{profile}: {exc}"

    sys.stderr.write(last_error or "Failed to fetch HTML")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
