# Rolling out cluster-local deployment declarations

This migration moves Flux declarations into each cluster, inlines shared Helm
values and replaces cluster values ConfigMaps with child resource patches.
Flux names, namespaces, shared build paths and managed resource owners stay the
same. The old unused Flux Operator optional-component lookup is removed.

## Before publishing the migration

For each cluster, capture the current HelmReleases and the ConfigMaps referenced
by their `spec.valuesFrom`. Keep the namespace/name inventory and a backup of
those ConfigMaps outside the repository. Scope this inventory to the migrated
`<release>-defaults` and `<release>-values` ConfigMaps; do not include application
configuration or Secrets. Optional references that do not exist need no action.

Annotate each existing ConfigMap in that inventory:

```sh
kubectl --context <cluster> -n <namespace> annotate configmap <name> \
  --field-manager=flux-client-side-apply \
  kustomize.toolkit.fluxcd.io/prune=disabled --overwrite
```

Use the `flux-client-side-apply` field manager so normal Flux reconciliation
does not remove the added annotation. Verify the annotation and field ownership
before publishing. This temporarily retains the old input
while parent and child Kustomizations reconcile independently. Without it, the
parent can remove an optional cluster override before the child updates its
HelmRelease, briefly exposing shared defaults. The Cilium override is particularly
important to retain through this transition.

## Reconcile and inspect

Publish the migration and reconcile the Git source and `cluster-apps`. Reconcile
core controllers first, then application owners and generated integrations.
Existing dependency relationships still apply; do not recreate Flux objects or
Helm releases as part of this move.

Check that every migrated child has observed the migration revision and is ready.
Check that every HelmRelease has dropped the migrated `valuesFrom` references,
has observed its current generation and is ready. Check Cilium connectivity and
application integrations before removing retained inputs. Reconciliation success
does not replace workload health checks.

The offline comparison for this changeset covered 165 Phoebe and 28 Rhea local
builds and the effective values of 98 HelmReleases. Remaining managed resources
and owner settings matched, excluding the deliberate local patches, opt-out
labels, removed values ConfigMaps and unused Flux Operator component lookup.
Phoebe's external `kanidm-git` source was not rendered; its declaration stayed
unchanged. This is a composition comparison, not evidence of live rollout.

## Remove retained inputs

Once all consumers have switched, confirm none of the ConfigMaps in the captured
inventory are referenced by a HelmRelease. Delete only those retained migration
inputs. Runtime ConfigMaps such as themes, application configuration and trust
bundles remain part of the deployment.

If rolling back before cleanup, the retained inputs are still available. After
cleanup, restore the captured values ConfigMaps before reconciling old release
definitions. Do not delete or uninstall a release to roll this layout back.
