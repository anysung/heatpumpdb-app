# Lista ZUM raw snapshot archive

Compressed copies of month folders that used to live in `../raw/`. They are
archived, not deleted: the raw grid + detail pages are the only primary
evidence for registry-native PL records (owner rule 2026-08-12).

- `2026-07.tar.zst` — 10,342 files, 556 MB uncompressed, archived 2026-10-25.
  No published record cited it any more (2026-10 build: 2,590 details from
  2026-09, 582 from 2026-10, 0 from 2026-07) and the fetcher only reads the
  immediately preceding snapshot, so nothing in the pipeline opened it.

Restore (recreates `../raw/2026-07/`):

    zstd -dc data_sources/lista_zum/raw_archive/2026-07.tar.zst | tar -C data_sources/lista_zum/raw -xf -

The grid pages hold a multi-MB ASP.NET __VIEWSTATE per page, which is why the
ratio is only ~2.2x; the detail pages themselves compress ~29x.
Archives are gitignored (`*.tar.zst`); this README is tracked.
