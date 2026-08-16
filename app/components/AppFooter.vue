<script setup lang="ts">
const year = new Date().getFullYear()

const links = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Index' },
  { to: '/schedule', label: 'Jadwal' },
  { to: '/trending', label: 'Trending' },
  { to: '/exclusive', label: 'Premium' },
  { to: '/history', label: 'History' },
  { to: '/favorites', label: 'My List' },
]
</script>

<template>
  <footer class="footer">
    <div class="inner">
      <div class="top">
        <NuxtLink
          to="/"
          class="brand"
        >
          <span class="mark">N</span>
          <span class="copy">
            <span class="name">NUSANIME</span>
            <span class="sub">Anime</span>
          </span>
        </NuxtLink>

        <nav
          class="links"
          aria-label="Footer"
        >
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>

      <div class="bottom">
        <span>© {{ year }} Nusanime</span>
        <span class="dot">·</span>
        <span>Subtitle Indonesia</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  position: relative;
  z-index: 1;
  margin-top: auto;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.inner {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 28px var(--gutter) 32px;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  color: inherit;
}

.mark {
  width: 34px;
  height: 34px;
  border-radius: 4px;
  background: var(--accent);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 800;
  display: grid;
  place-items: center;
}

.copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-size: 0.9375rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.1;
}

.sub {
  color: var(--text-muted);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.links {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

.links a {
  padding: 6px 10px;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
}

.links a:hover {
  color: var(--text);
  background: var(--bg-muted);
}

.bottom {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 0.75rem;
}

.dot {
  opacity: 0.5;
}

@media (max-width: 800px) {
  .top {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .links {
    justify-content: flex-start;
    margin: 0 -6px;
  }
}
</style>
