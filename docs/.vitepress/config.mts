import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Ops',
  description: 'My Kubernetes cluster and services documentation',
  base: '/ops/',
  lang: 'en-GB',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Clusters', link: '/clusters/phoebe' },
      { text: 'Core', link: '/core/pki' },
      { text: 'Standards', link: '/standards/labels' },
    ],
    sidebar: [
      {
        text: 'Clusters',
        items: [
          { text: 'Phoebe', link: '/clusters/phoebe' },
          { text: 'Rhea', link: '/clusters/rhea' },
        ]
      },
      {
        text: 'Core Infrastructure',
        items: [
          { text: 'GitOps', link: '/core/gitops' },
          { text: 'Networking', link: '/core/networking' },
          { text: 'PKI', link: '/core/pki' },
          { text: 'Secrets', link: '/core/secrets' },
          { text: 'Security', link: '/core/security' },
        ]
      },
      {
        text: 'Standards',
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
