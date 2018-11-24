const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const solc = require("solc");
const Web3 = require("web3");
const uuidv4 = require("uuid/v4");
const { spawnSync, execFileSync } = require("child_process");

// Default ABI
const verifierAbi = JSON.parse(
  `[{"constant":false,"inputs":[{"name":"a","type":"uint256[2]"},{"name":"a_p","type":"uint256[2]"},{"name":"b","type":"uint256[2][2]"},{"name":"b_p","type":"uint256[2]"},{"name":"c","type":"uint256[2]"},{"name":"c_p","type":"uint256[2]"},{"name":"h","type":"uint256[2]"},{"name":"k","type":"uint256[2]"},{"name":"input","type":"uint256[5]"}],"name":"verifyTx","outputs":[{"name":"r","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"s","type":"string"}],"name":"Verified","type":"event"}]`
);

const infuraRopsten =
  "https://ropsten.infura.io/v3/dc688a3e8d5c42a9a74afd0104f09e8e";

const ethereumAddress = "0x60ED728aC6D4bA1a3cE891858Ba049aAc795FD7C";
const ethereumPubKey =
  "0x03eed79968412e7a2544a24154d47d12410928e8a9fedd47ef4f678a2247036280";
const ethereumPrivateKey =
  "0xe3daba6201be1a13985c21264fd61a5f5d71ce8aec9a431c3b0afe2f9290da0c";

// Web3 w/ infura
const web3 = new Web3(new Web3.providers.HttpProvider(infuraRopsten));
web3.eth.accounts.wallet.add(ethereumPrivateKey);

// Zokrose DSL
// hashVerifier data
const hashWitnessData = `
import "LIBSNARK/sha256packed"

def main(private field a, private field b, private field c, private field d) -> (field, field):
    h0, h1 = sha256packed(a, b, c, d)
    return h0, h1
`;

const hashVerifierData = (out0, out1) => {
  return `
import "LIBSNARK/sha256packed"

def main(field a, field b, field c, field d) -> (field):
    h0, h1 = sha256packed(a, b, c, d)
    h0 == ${out1}
    h1 == ${out0}
    return 1
    `;
};

// Directory stuff
const proofDir = "./proofs";
if (!fs.existsSync(proofDir)) {
  fs.mkdir(proofDir);
}

// REST API
const app = express();
const port = 5000;

app.use(bodyParser.json());

app.post("/new", (req, res) => {
  // Make directory
  const { num1, num2, num3, num4 } = req.body;

  const combinations = [num1, num2, num3, num4].map(x => {
    return parseInt(x);
  });

  // Make sure they're all defined
  const noNans = combinations.reduce((acc, x) => acc && !isNaN(x), true);

  // Checkes
  if (!noNans) {
    res.status(400).send({ error: "Need num1, num2, num3, num4 in numbers" });
    return;
  }

  const uuid = uuidv4();
  const currentDir = `${proofDir}/${uuid}`;

  // Make directory
  fs.mkdirSync(currentDir);

  // Write to file
  fs.writeFileSync(`${currentDir}/hashWitness.code`, hashWitnessData);

  // Call zokrates and compile output
  execFileSync("zokrates", ["compile", "-i", `hashWitness.code`], {
    cwd: path.resolve(__dirname, currentDir)
  });

  // Call zokrates and generate witness
  execFileSync(`zokrates`, ["compute-witness", "-a", num1, num2, num3, num4], {
    cwd: path.resolve(__dirname, currentDir)
  });

  // Proof out
  const proofsOut = spawnSync(
    `grep '~out' ${path.resolve(__dirname, currentDir + "/witness")}`,
    [],
    {
      shell: true
    }
  );

  const [s1, out1, s2, out2] = proofsOut.stdout
    .toString()
    .split("\n")
    .map(x => x.split(" "))
    .reduce((x, y) => x.concat(y), []);

  // Remove all files
  execFileSync(`rm`, ["-rf", "out*"], {
    cwd: path.resolve(__dirname, currentDir)
  });

  res.send({
    uuid,
    out1,
    out2
  });
});

app.post("/verifier/:uuid", async (req, res) => {
  const uuid = req.params.uuid;
  const currentDir = `${proofDir}/${uuid}`;

  if (!fs.existsSync(currentDir)) {
    res.status(400).send({ error: "witness does not exist!" });
    return;
  }

  // Get outs
  const { out1, out2 } = req.body;
  const outs = [out1, out2];

  // Make sure they're all defined
  const noNans = outs.reduce((acc, x) => acc && !isNaN(x), true);

  // Checkes
  if (!noNans) {
    res.status(400).send({ error: "Need out1, out2 in numbers" });
    return;
  }

  // Write to file
  fs.writeFileSync(
    `${currentDir}/hashVerifier.code`,
    hashVerifierData(out1, out2)
  );

  // Generate verification
  execFileSync("zokrates", ["compile", "-i", `hashVerifier.code`], {
    cwd: path.resolve(__dirname, currentDir)
  });

  // Create verifier smart contract
  execFileSync("zokrates", [`setup`], {
    cwd: path.resolve(__dirname, currentDir)
  });

  execFileSync("zokrates", [`export-verifier`], {
    cwd: path.resolve(__dirname, currentDir)
  });

  // Read contract, compile it, then deploy it
  const solcInput = fs.readFileSync(
    path.resolve(__dirname, currentDir + "/verifier.sol"),
    "utf8"
  );
  const solcCompiled = solc.compile(solcInput, 1);
  const verifier = solcCompiled.contracts[":Verifier"];

  // Deploy contract
  const result = await new web3.eth.Contract(JSON.parse(verifier.interface))
    .deploy({ data: "0x" + verifier.bytecode, arguments: [] })
    .send({
      gas: 4712388,
      gasLimit: 200000,
      gasPrice: 100000000000,
      from: ethereumAddress
    });

  // Verifier address
  res.send({
    contractAddress: result.options.address
  });
});

app.post("/prover/:uuid", async (req, res) => {
  const uuid = req.params.uuid;
  const currentDir = `${proofDir}/${uuid}`;

  if (!fs.existsSync(currentDir)) {
    res.status(400).send({ error: "witness does not exist!" });
    return;
  }

  const { contractAddress, num1, num2, num3, num4 } = req.body;

  const combinations = [num1, num2, num3, num4].map(x => {
    return parseInt(x);
  });

  // Make sure they're all defined
  const noNans = combinations.reduce((acc, x) => acc && !isNaN(x), true);

  // Checkes
  if (!noNans || contractAddress === undefined) {
    res
      .status(400)
      .send({
        error:
          "Need num1, num2, num3, num4 in numbers, and contractAddress (eth address)"
      });
    return;
  }

  execFileSync("zokrates", ["compute-witness", "-a", num1, num2, num3, num4], {
    cwd: path.resolve(__dirname, currentDir)
  });

  execFileSync("zokrates", [`generate-proof`], {
    cwd: path.resolve(__dirname, currentDir)
  });

  // Read proving.json
  const provingRaw = fs.readFileSync(`${currentDir}/proof.json`, "utf8");
  const provingJson = JSON.parse(provingRaw);

  // Get proofs
  const args = Object.keys(provingJson.proof).reduce((acc, x) => {
    acc.push(provingJson.proof[x]);
    return acc;
  }, []);

  const [A, A_p, B, B_p, C, C_p, H, K] = args;

  // Send solution to contract ETH
  const contract = new web3.eth.Contract(verifierAbi, contractAddress);
  contract.setProvider(web3.currentProvider);

  const contractRes = await contract.methods
    .verifyTx(A, A_p, B, B_p, C, C_p, H, K, [0, 0, 0, 0, 1])
    .send({ gas: "4712388", from: ethereumAddress });

  res.send({
    txHash: contractRes.transactionHash,
    result: contractRes.status
  });
});

// RUN REST API
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
