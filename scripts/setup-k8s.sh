#!/bin/bash
set -euo pipefail

# Namespaces: platform services live in `synaro`, user projects in `synaro-projects`.
for ns in synaro synaro-projects; do
  kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f -
done

# ServiceAccount + RBAC that lets execution-manager manage project workloads.
kubectl apply -f k8s/execution-manager/serviceaccount.yaml
kubectl apply -f k8s/execution-manager/rbac.yaml

echo "Namespaces synaro / synaro-projects ready; execution-manager RBAC applied."
