# Polkadot JS API Asset Ordering Bug Demonstration

This repository demonstrates a bug in the Polkadot JS API where the order of assets in the `transferAssetsUsingTypeAndThen` extrinsic affects whether dry runs succeed or fail with WASM errors.

## 🐛 Bug Description

The `transferAssetsUsingTypeAndThen` extrinsic in Polkadot JS API exhibits unexpected behavior where asset ordering in the assets array determines success/failure of dry run operations:

- **WUD Token**: Must be placed **first** in the assets array, otherwise dry run fails with WASM error
- **KSM Token**: Must be placed **second** in the assets array (DOT first), otherwise dry run fails with WASM error

This bug was discovered in the Snowbridge project where special ordering logic had to be implemented as a workaround in the `createERC20ToKusamaTx` function.

## 🔧 Asset Definitions

### WUD (GAVUN WUD Token)
```typescript
{
  token: "0x5fdcd48f09fb67de3d202cd854b372aec1100ed5",
  name: "GAVUN WUD",
  symbol: "WUD",
  decimals: 10,
  location: {
    parents: 0,
    interior: {
      x2: [
        { palletInstance: 50 },
        { generalIndex: 31337 }
      ]
    }
  }
}
```

### KSM (Kusama Token)
```typescript
{
  token: "0x12bbfdc9e813614eef8dc8a2560b0efbeaf7c2ab",
  name: "Kusama",
  symbol: "KSM",
  decimals: 12,
  location: {
    parents: 2,
    interior: {
      x1: [
        { globalConsensus: { kusama: null } }
      ]
    }
  }
}
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation & Usage

1. **Clone this repository** (or create it from the files)
   ```bash
   git clone <repo-url>
   cd polkadot-asset-ordering-bug-demo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the demonstration**
   ```bash
   npm run demo
   ```

### Environment Variables

You can customize the Asset Hub endpoint:

```bash
export POLKADOT_ASSET_HUB_WSS="wss://your-custom-endpoint"
npm run demo
```

## 📊 Expected Results

When you run the demo, you should observe:

### WUD Token Results:
- ✅ **Token-first ordering**: Should work
- ❌ **DOT-first ordering**: Should fail with WASM error

### KSM Token Results:
- ❌ **Token-first ordering**: Should fail with WASM error
- ✅ **DOT-first ordering**: Should work

## 🔍 Technical Details

The bug occurs in the `transferAssetsUsingTypeAndThen` extrinsic when:

1. Creating assets array with different orderings
2. Performing dry run via `api.call.dryRunApi.dryRunCall`
3. WASM execution fails based on asset position

### Code Example

```typescript
// This works for WUD but fails for KSM
const assets = {
  v4: [
    { id: tokenLocation, fun: { Fungible: amount } },      // Token first
    { id: NATIVE_TOKEN_LOCATION, fun: { Fungible: fee } }   // DOT second
  ]
}

// This works for KSM but fails for WUD
const assets = {
  v4: [
    { id: NATIVE_TOKEN_LOCATION, fun: { Fungible: fee } },  // DOT first
    { id: tokenLocation, fun: { Fungible: amount } }        // Token second
  ]
}
```

## 🛠️ Workaround Implementation

In the Snowbridge codebase, this workaround was implemented:

```typescript
// From createERC20ToKusamaTx function
if (isKSM(Direction.ToKusama, tokenLocation)) {
    // KSM needs DOT first
    assets = {
        v4: [
            { id: NATIVE_TOKEN_LOCATION, fun: { Fungible: destFeeInSourceNative } },
            { id: tokenLocation, fun: { Fungible: amount } },
        ],
    }
} else {
    // WUD and other tokens need token first
    assets = {
        v4: [
            { id: tokenLocation, fun: { Fungible: amount } },
            { id: NATIVE_TOKEN_LOCATION, fun: { Fungible: destFeeInSourceNative } },
        ],
    }
}
```

## 🎯 Impact

This bug affects:
- Cross-chain transfers using `transferAssetsUsingTypeAndThen`
- Dry run validation accuracy
- DApp reliability when testing transactions
- Development workflow requiring trial-and-error to find correct ordering

## 📋 Reproducibility

To reproduce this issue:

1. Use Polkadot Asset Hub
2. Create `transferAssetsUsingTypeAndThen` extrinsic with WUD/KSM assets
3. Try both asset orderings
4. Observe dry run results

## 🐛 Issue Report Template

When reporting this to Polkadot JS API, include:

**Environment:**
- Polkadot JS API version: 16.4.7
- Network: Polkadot Asset Hub
- Runtime: [version from output]

**Steps to Reproduce:**
1. Run this demo script
2. Observe different results for different asset orderings
3. Note WASM errors for incorrect orderings

**Expected Behavior:**
Asset ordering should not affect dry run success/failure

**Actual Behavior:**
Asset ordering determines whether dry run succeeds or fails with WASM errors

## 📄 License

Apache-2.0

## 🤝 Contributing

Feel free to improve this demonstration or add more test cases to help identify the root cause of this ordering dependency.