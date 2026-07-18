# News article images (shared across ALL market editions)

Put news-article images here as **.webp**. This folder ships with every
country build (public/ is shared; only data/** is excluded from hosting), so
the SAME file is served by every site — reference it market-independently as:

    /news-images/<name>.webp

e.g. in a Firestore news doc:  "imageUrl": "/news-images/subsidy-2026.webp"
(relative URLs resolve against whichever market domain renders the article;
absolute URLs to one market's domain would break the others' caching/CORS —
don't use them).

Conventions:
- lowercase-kebab-case names, content-descriptive (no dates unless meaningful);
- .webp only, keep files ≤ ~300 KB (news cards render ~800px wide);
- images must be licensed for our use (own material / purchased / CC0) —
  never hotlink or copy registry/GSE/press assets;
- files are cache-forever by hosting defaults — when replacing an image,
  use a NEW filename instead of overwriting.
