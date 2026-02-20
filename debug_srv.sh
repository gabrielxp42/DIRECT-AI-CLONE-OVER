#!/bin/bash
echo "=== DOCKER SERVICES ==="
docker service ls
echo "=== PORT 8080 CONTEXT ==="
netstat -tulnp | grep 8080
echo "=== EVOLUTION INSPECT ==="
docker service inspect evodirectai_evolution --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}'
echo "=== FIXING SERVICE ==="
# Remove port 8080 if it's stuck in host mode
docker service update --publish-rm 8080 evodirectai_evolution
# Re-add port 8080 in ingress mode (default)
docker service update --publish-add 8080:8080 evodirectai_evolution
echo "=== LOGS ==="
docker service logs evodirectai_evolution --tail 20
