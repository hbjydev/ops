import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Ops',
  description: 'My Kubernetes cluster and services documentation',
  base: '/ops/',
  lang: 'en-GB',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Standards', link: '/standards/' },
    ],
    sidebar: [
      {
        text: 'Standards',
        link: '/standards/',
        items: [
          { text: 'Labels', link: '/standards/labels' },
          { text: 'Network Policies', link: '/standards/netpols' },
          { text: 'PKI', link: '/standards/pki' },
        ]
      },
    ],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/hbjydev/ops/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/hbjydev/ops' }
    ]
  },
  markdown: {
    config(md) {
      const fence = md.renderer.rules.fence!
      md.renderer.rules.fence = (tokens, index, options, env, self) => {
        const token = tokens[index]
        if (token.info.trim() === 'mermaid') {
          const code = md.utils.escapeHtml(JSON.stringify(token.content))
          return `<MermaidDiagram :code="${code}" />\n`
        }
        return fence(tokens, index, options, env, self)
      }
    }
  }
})
