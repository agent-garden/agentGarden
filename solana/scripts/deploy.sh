#!/usr/bin/env bash
set -euo pipefail

# Build and deploy the Agent Garden Solana Escrow smart contract.
# Requires: rustc, cargo, solana-cli, anchor-cli

CLUSTER="${1:-devnet}"
TREASURY="${2:-$(solana address)}"
echo "Building agent_garden_escrow for cluster: $CLUSTER"

cd "$(dirname "$0")/.."

anchor build --no-idl
anchor idl build -o target/idl/agent_garden_escrow.json -t target/types/agent_garden_escrow.ts || true

PROGRAM_KEYPAIR="target/deploy/agent_garden_escrow-keypair.json"
PROGRAM_ID=$(solana address -k "$PROGRAM_KEYPAIR")
echo "Program ID: $PROGRAM_ID"

solana program deploy target/deploy/agent_garden_escrow.so \
  --program-id "$PROGRAM_KEYPAIR" \
  --url "$CLUSTER" \
  --use-rpc \
  --with-compute-unit-price 50000

echo "Initializing PlatformConfig PDA on $CLUSTER..."
node scripts/init-platform.mjs "$CLUSTER" "$TREASURY" "$PROGRAM_ID"

echo ""
echo "Deployment complete!"
echo "Add these to your .env / apphosting.yaml:"
echo "  NEXT_PUBLIC_SOLANA_CLUSTER=$CLUSTER"
echo "  NEXT_PUBLIC_SOLANA_PROGRAM_ID=$PROGRAM_ID"
echo "  NEXT_PUBLIC_SOLANA_TREASURY=$TREASURY"
