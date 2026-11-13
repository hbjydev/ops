# Rhea

My testing cluster (for now), used as a testbed.

## Local storage

Miroir stores local volumes as files under `/var/lib/miroir` on the existing system disk.
Its `loopfile` backend presents each file as a block device.
The Talos image supports this backend without additional extensions or disk partitions.

The default storage class is `miroir-local`, with one copy of each volume and an ext4 filesystem.
A persistent volume claim (PVC) requests storage for an application.
Miroir creates the volume when Kubernetes schedules a pod that uses the claim.
Deleting the claim deletes its volume.
The `miroir-snap` class supports snapshots, which capture a volume at a point in time.

The controller limits total requested volume sizes to 39% of the filesystem capacity, approximately 24 GiB on this VM.
The chart accepts only integer ratios, so `extraArgs` supplies `--overcommit-ratio=0.39` after the generated flag.
The `freeSpaceRatio: 1` value also prevents a new volume request from exceeding the current free space.
These limits control storage requests, not total disk usage.
Snapshots, container images, logs, and Talos share the remaining space.
Snapshots remain on the same disk and do not protect against disk loss.

The controller configuration is in `kube/deploy/apps/rhea/miroir-system/miroir/controller.yaml`.
Application Kustomizations can depend on `miroir-config` in the `miroir-system` namespace.
Flux deploys the controller before the node, storage class, and snapshot class resources.

The upstream [single-node example](https://miroir.home-operations.com/quickstart/#1-describe-your-storage)
and [Talos requirements](https://miroir.home-operations.com/requirements/#node-setup-by-os) describe the backend requirements.
