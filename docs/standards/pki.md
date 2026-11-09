# PKI (Public Key Infrastructure)

All clusters managed by this repository use [trust-manager](https://cert-manager.io/docs/trust/trust-manager/)
to manage distribution of trusted roots to workload pods, and [Kyverno](http://kyverno.io/)
to apply the trusted root bundle to every workload pod in the cluster.

## Configuration

The _internal_ PKI uses a Kyverno `MutatingPolicy` to deploy certificates to
pods by default, with a small amount of configuration to make that rollout
easier.

### Supported Profiles

To set the profile used by a Pod, you can annotate it with the
`trust.home.arpa/profile` annotation.

| Profile      | Description                                                                    | Environment variables provided                   |
| ------------ | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| `default`    | The default trust profile.                                                     | `SSL_CERT_FILE`                                  |
| `python`     | Provides support for Requests.                                                 | `SSL_CERT_FILE`, `REQUESTS_CA_BUNDLE`            |
| `node`       | Provides support for Node.js.                                                  | `SSL_CERT_FILE`, `NODE_EXTRA_CA_CERTS`           |
| `curl`       | Provides support for Requests.                                                 | `SSL_CERT_FILE`, `CURL_CA_BUNDLE`                |
| `mount-only` | Only mounts the trust bundle, allowing applications to override loading logic. | None, mounted at `/var/run/trusted-roots/ca.crt` |

### Opting out

To opt out of trust root injection, you can set the following annotation on your
Pod:

```
trust.home.arpa/inject=false
```
