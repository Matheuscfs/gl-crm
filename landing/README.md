# Landing (Astro)

Public page for the CRM, separate from the app: static HTML, indexable, no React or Supabase SDK in the bundle.
The 3D at the top uses the same tooth modeling as the app's odontogram (`../src/lib/dente3d.ts`)
and only loads Three.js once the 3D stage comes into view.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # gera dist/
```

- **Name and copy:** the name is provisional and lives in `src/site.ts` (changing it there changes it everywhere).
- **Waitlist:** run `supabase/lista_espera.sql` in the Supabase project you choose and set
  `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_KEY` (publishable key). Without them, the form only
  confirms in development mode; in production it shows an error instead of pretending it saved.
  Read the list in the Supabase dashboard (the public key can only insert).
- **Domain:** `SITE_URL` generates canonical and `og:url`.

## Publishing on Vercel

A second Vercel project pointed at this same repository, with **Root Directory = `landing`**
(Astro preset) and the "Include files outside the Root Directory" option enabled (the default),
because the 3D imports `../src/lib/dente3d.ts`. Use the main domain for the landing and `app.` for the CRM.
