#!/usr/bin/env tsx
/**
 * Polkadot JS API Asset Ordering Bug Demonstration
 *
 * This script reproduces a bug in the Polkadot JS API where the order of assets
 * in the `transferAssetsUsingTypeAndThen` extrinsic affects whether the dry run
 * succeeds or fails with WASM errors.
 *
 * Bug Details:
 * - For WUD token: WUD must be first in the assets array, otherwise dry run fails
 * - For KSM token: KSM must be second in the assets array (DOT first), otherwise dry run fails
 *
 * This is based on observations from the Snowbridge codebase where special ordering
 * logic was implemented as a workaround in createERC20ToKusamaTx function.
 */

import { ApiPromise, WsProvider } from "@polkadot/api"
import { BN } from "@polkadot/util"

// WUD Asset metadata (GAVUN WUD token)
const WUD_ASSET = {
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
  },
  assetId: "31337"
}

// KSM Asset metadata
const KSM_ASSET = {
  token: "0x12bbfdc9e813614eef8dc8a2560b0efbeaf7c2ab",
  name: "Kusama",
  symbol: "KSM",
  decimals: 12,
  location: {
    parents: 2,
    interior: {
      x1: [
        {
          globalConsensus: {
            kusama: null
          }
        }
      ]
    }
  }
}

// Native DOT location on Polkadot Asset Hub
const NATIVE_TOKEN_LOCATION = {
  parents: 1,
  interior: "Here"
}

// Kusama Asset Hub Para ID
const KUSAMA_ASSET_HUB_PARA_ID = 1000

/**
 * Creates a basic XCM message for the demo
 */
function createDummyXCM(beneficiary: string) {
  return {
    v4: [
      {
        DepositAsset: {
          assets: {Wild: { AllCounted: '2' } },
          beneficiary: {
            parents: 0,
            interior: {
              x1: [
                {
                  AccountId32: {
                    network: null,
                    id: beneficiary
                  }
                }
              ]
            }
          }
        }
      }
    ]
  }
}

/**
 * Creates a transferAssetsUsingTypeAndThen extrinsic with specified asset ordering
 */
function createTransferExtrinsic(
  api: ApiPromise,
  tokenLocation: any,
  amount: string,
  destFee: string,
  assetOrder: "token-first" | "dot-first",
  beneficiary: string
) {
  const destination = {
    v4: {
      parents: 2,
      interior: { x2: [{ GlobalConsensus: { Kusama: null } }, { parachain: KUSAMA_ASSET_HUB_PARA_ID }] },
    }
  }

  let reserveType = "LocalReserve"
  if (tokenLocation == KSM_ASSET.location) {
    reserveType = "DestinationReserve"
  }

  let assets: any
  if (assetOrder === "token-first") {
    // Token first, then DOT - this is what WUD needs according to the bug
    assets = {
      v4: [
        {
          id: tokenLocation,
          fun: { Fungible: amount }
        },
        {
          id: NATIVE_TOKEN_LOCATION,
          fun: { Fungible: destFee }
        }
      ]
    }
  } else {
    // DOT first, then token - this is what KSM needs according to the bug
    assets = {
      v4: [
        {
          id: NATIVE_TOKEN_LOCATION,
          fun: { Fungible: destFee }
        },
        {
          id: tokenLocation,
          fun: { Fungible: amount }
        }
      ]
    }
  }

  const feeAsset = {
    v4: NATIVE_TOKEN_LOCATION
  }

  const customXcm = createDummyXCM(beneficiary)

  return api.tx.polkadotXcm.transferAssetsUsingTypeAndThen(
    destination,
    assets,
      reserveType,
    feeAsset,
    "LocalReserve",
    customXcm,
    "Unlimited"
  )
}

/**
 * Tests dry run with different asset orderings
 */
async function testAssetOrdering(
  api: ApiPromise,
  asset: any,
  testAccount: string,
  amount: string,
  fee: string
) {
  // Test with token first
  console.log(`1. Testing ${asset.symbol} with token-first ordering...`)
  const tokenFirstTx = createTransferExtrinsic(
    api,
    asset.location,
    amount,
    fee,
    "token-first",
    testAccount
  )

  try {
    const dryRunResult1 = await api.call.dryRunApi.dryRunCall(
      { system: { signed: testAccount } },
      tokenFirstTx,
        4
    )

    const success1 = dryRunResult1.isOk && dryRunResult1.asOk.executionResult.isOk
    console.log(`   ${success1 ? '✅' : '❌'} ${asset.symbol} token-first: ${success1 ? 'SUCCESS' : 'FAILED'}`)

    if (!success1) {
      const error = dryRunResult1.isOk
        ? dryRunResult1.asOk.executionResult.asErr.toHuman()
        : dryRunResult1.asErr.toHuman()
      console.log(`   📋 Error details:`, JSON.stringify(error, null, 2))
    }
  } catch (error) {
    console.log(`   ❌ ${asset.symbol} token-first: EXCEPTION -`, error.message)
  }

  // Test with DOT first
  console.log(`2. Testing ${asset.symbol} with DOT-first ordering...`)
  const dotFirstTx = createTransferExtrinsic(
    api,
    asset.location,
    amount,
    fee,
    "dot-first",
    testAccount
  )

  try {
    const dryRunResult2 = await api.call.dryRunApi.dryRunCall(
      { system: { signed: testAccount } },
      dotFirstTx,
        4
    )

    const success2 = dryRunResult2.isOk && dryRunResult2.asOk.executionResult.isOk
    console.log(`   ${success2 ? '✅' : '❌'} ${asset.symbol} DOT-first: ${success2 ? 'SUCCESS' : 'FAILED'}`)

    if (!success2) {
      const error = dryRunResult2.isOk
        ? dryRunResult2.asOk.executionResult.asErr.toHuman()
        : dryRunResult2.asErr.toHuman()
      console.log(`   📋 Error details:`, JSON.stringify(error, null, 2))
    }
  } catch (error) {
    console.log(`   ❌ ${asset.symbol} DOT-first: EXCEPTION -`, error.message)
  }
}

/**
 * Main function to demonstrate the asset ordering bug
 */
async function demonstrateAssetOrderingBug() {
  console.log("🔍 Polkadot JS API Asset Ordering Bug Demonstration")
  console.log("=" .repeat(60))
  console.log("This script demonstrates that asset order matters in transferAssetsUsingTypeAndThen")
  console.log("")

  // Default endpoints - you can modify these to use different networks
  const POLKADOT_ASSET_HUB_WSS = process.env.POLKADOT_ASSET_HUB_WSS || "wss://polkadot-asset-hub-rpc.polkadot.io"

  console.log(`📡 Connecting to Polkadot Asset Hub: ${POLKADOT_ASSET_HUB_WSS}`)

  try {
    const provider = new WsProvider(POLKADOT_ASSET_HUB_WSS)
    const api = await ApiPromise.create({ provider })

    const testAccount = "0x460411e07f93dc4bc2b3a6cb67dad89ca26e8a54054d13916f74c982595c2e0e"
    const amount = "50000000000"

    // Test WUD asset ordering
    await testAssetOrdering(api, WUD_ASSET, testAccount, amount, "29876830")

    // Test KSM asset ordering
    await testAssetOrdering(api, KSM_ASSET, testAccount, amount, "18718740000")

    await api.disconnect()

  } catch (error) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateAssetOrderingBug().catch((error) => {
    console.error("❌ Demo failed:", error)
    process.exit(1)
  })
}
