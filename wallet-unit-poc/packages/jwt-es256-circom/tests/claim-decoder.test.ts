import { sha256 } from "@noble/hashes/sha2";
import assert from "assert";
import { WitnessTester } from "circomkit";
import { circomkit } from "./common";
import { encodeClaims } from "../src/utils";

describe("ClaimDecoder", () => {
  let circuit: WitnessTester<["claims", "claimLengths", "decodeFlags"], ["decodedClaims", "claimHashes"]>;

  const maxClaimsLength = 128;
  const maxClaims = 3;

  before(async () => {
    circuit = await circomkit.WitnessTester("ClaimDecoder", {
      file: "claim-decoder",
      template: "ClaimDecoder",
      params: [maxClaims, maxClaimsLength],
      recompile: true,
    });
  });

  it("It should decode raw claims with padding correctly", async () => {
    const inputs = [
      "WyJ1cWJ5Y0VSZlN4RXF1a0dtWGwyXzl3IiwibmFtZSIsImRlbmtlbmkiXQ",
      "WyJYMXllNDloV0s1bTJneWFBLXROQXRnIiwicm9jX2JpcnRoZGF5IiwiMDc1MDEwMSJd",
    ];
    const expectedOutputs = inputs.map(atob);

    const { claimArray, claimLengths } = encodeClaims(inputs, maxClaims, maxClaimsLength);

    const decodeFlags = [1, 1, 1];
    const witness = await circuit.calculateWitness({
      claims: claimArray,
      claimLengths,
      decodeFlags,
    });

    const outputs = await circuit.readWitnessSignals(witness, ["decodedClaims", "claimHashes"]);

    const decodedClaims = outputs.decodedClaims as number[][];
    const circuitClaimHash = outputs.claimHashes as number[][];

    for (let i = 0; i < inputs.length; i++) {
      const length = Number(claimLengths[i]);
      const base64 = decodedClaims[i]
        .slice(0, length)
        .map((c) => String.fromCharCode(Number(c)))
        .join("")
        .replace(/[\x00-\x1F]+$/g, "");

      assert.strictEqual(base64, expectedOutputs[i]);

      const expectedHash = sha256(Uint8Array.from(Buffer.from(inputs[i].slice(0, length), "utf8")));
      const expectedHashHex = Array.from(expectedHash, (b) => b.toString(16).padStart(2, "0")).join("");
      const circuitHashHex = circuitClaimHash[i].map((b) => b.toString(16).padStart(2, "0")).join("");

      assert.strictEqual(circuitHashHex, expectedHashHex);
    }
    await circuit.expectConstraintPass(witness);
  });

  it("It should decode raw claims without padding correctly", async () => {
    const testcase = [
      "WyJmSGlPTE9ZRVFhZkF3MjBCZjRxZXpBIiwibmFtZSIsIumZs-etseeOsiJd",
      "WyJLVXYxVF9BNXpvVDlJbXFURmUwdUxnIiwiaWRfbnVtYmVyIiwiQTIzNDU2Nzg5MCJd",
      "WyJuTDVDa2VaV2paSG13UjcxV05lWlZ3Iiwicm9jX2JpcnRoZGF5IiwiMDU3MDYwNSJd",
      "WyJvZFNweWFjaUNuZUJneld1VEFyM0pRIiwidHlwZSIsIuaZrumAmuWwj-Wei-i7iiJd",
      "WyJJdFVGQUV2S0kybFJCV2MzU19LTjhnIiwiY29udHJvbG51bWJlciIsIjQwMTA0MDIwOTE0NDUiXQ",
      "WyJROWEySWM3b1IxUjRFQ0VXX3RYaUlRIiwiZ0RhdGUiLCIxMDIwNzAxIl0",
    ];
    const maxClaimsLength = 128;
    const maxClaims = 6;

    circuit = await circomkit.WitnessTester("ClaimDecoder", {
      file: "claim-decoder",
      template: "ClaimDecoder",
      params: [maxClaims, maxClaimsLength],
      recompile: true,
    });

    const decodeFlags = [0, 0, 1, 0, 0, 0];
    const base64urlToBase64 = (b64url: string) => {
      let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      const pad = (4 - (b64.length % 4)) % 4;
      return b64 + "=".repeat(pad);
    };
    const expectedOutputs = testcase.map((s) => atob(base64urlToBase64(s)));
    const { claimArray, claimLengths } = encodeClaims(testcase, maxClaims, maxClaimsLength);

    const witness = await circuit.calculateWitness({
      claims: claimArray,
      claimLengths,
      decodeFlags,
    });

    const outputs = await circuit.readWitnessSignals(witness, ["decodedClaims", "claimHashes"]);

    const decodedClaims = outputs.decodedClaims as number[][];
    const circuitClaimHash = outputs.claimHashes as number[][];

    for (let i = 0; i < testcase.length; i++) {
      const length = Number(claimLengths[i]);
      const base64 = decodedClaims[i]
        .slice(0, length)
        .map((c) => String.fromCharCode(Number(c)))
        .join("")
        .replace(/[\x00-\x1F]+$/g, "");

      if (decodeFlags[i] === 1) {
        assert.strictEqual(base64, expectedOutputs[i]);
      } else {
        assert.strictEqual(base64, "");
      }

      const expectedHash = sha256(Uint8Array.from(Buffer.from(testcase[i].slice(0, length), "utf8")));
      const expectedHashHex = Array.from(expectedHash, (b) => b.toString(16).padStart(2, "0")).join("");
      const circuitHashHex = circuitClaimHash[i].map((b) => b.toString(16).padStart(2, "0")).join("");

      assert.strictEqual(circuitHashHex, expectedHashHex);
    }

    await circuit.expectConstraintPass(witness);
  });
});
