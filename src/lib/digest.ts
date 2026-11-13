import { encodeAbiParameters, keccak256, type Address, type Hex } from 'viem'
import type { ProofRecord } from './types'

/**
 * Recomputes a contribution digest in the browser, exactly as OrvexProof does:
 * keccak256(abi.encode(id, contributor, attestor, source, sourceId, title, uri, chainid, proof)).
 * Comparing it with the stored digest verifies the record without trusting the UI.
 */
export function computeDigest(record: ProofRecord, chainId: number, proof: Address): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'uint64' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint8' },
        { type: 'uint64' },
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
      ],
      [record.id, record.contributor, record.attestor, record.source, record.sourceId, record.title, record.uri, BigInt(chainId), proof],
    ),
  )
}
