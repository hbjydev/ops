# Core PKI & Trust

All clusters provisioned by this repository provide an internal and external PKI
setup using [cert-manager](https://cert-manager.io).

## Internal PKI

Refer to the [PKI standards document](../standards/pki.md).

## External PKI

Every cluster gets a staging and production [Let's Encrypt](https://letsencrypt.org)
cluster issuer, which can be used to issue public TLS certificates.
