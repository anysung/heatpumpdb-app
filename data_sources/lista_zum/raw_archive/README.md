# Lista ZUM raw snapshot archive

Compressed copies of month folders that used to live in `../raw/`. They are
archived, not deleted: the raw grid + detail pages are the only primary
evidence for registry-native PL records (owner rule 2026-08-12).

- `2026-07.tar.zst` — 10,342 files, 556 MB uncompressed, archived 2026-10-25.
  No published record cited it any more (2026-10 build: 2,590 details from
  2026-09, 582 from 2026-10, 0 from 2026-07) and the fetcher only reads the
  immediately preceding snapshot, so nothing in the pipeline opened it.

- `2026-09.tar.zst` — 10,369 files, 553 MB uncompressed, archived 2026-11-01 after
  the November crawl. The fetcher had carried its pages forward into 2026-10 and
  2026-11 (physical copies), so no pipeline step opened the folder any more; the
  2026-11 build still cites 2,109 details fetched in 2026-09 — the evidence for
  those lives in the copies and, now, in this archive.

Restore (recreates `../raw/<month>/`):

    zstd -dc data_sources/lista_zum/raw_archive/<month>.tar.zst | tar -C data_sources/lista_zum/raw -xf -

The grid pages hold a multi-MB ASP.NET __VIEWSTATE per page, which is why the
ratio is only ~2.2x; the detail pages themselves compress ~29x.
Archives are gitignored (`*.tar.zst`); this README is tracked.
