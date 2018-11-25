# zkr
ZoKrates Relayer (Zero Knowledge Relayer)

# Use-case
Adam owns a lock, and Bob wants to prove that he knows the combination of the lock to Adam. They decided to do that through Ethereum.
The problem with deploying a contract that checks if Bob knows the combination of Adam's lock is that you'll need to pass in the combination
of the lock somewhere in the contract, which is a big nono.

We can avoid putting the actual combination of Adam's lock online by using Zero Knowledge Proofs.

Adam (the verifier) creates a new witness and zero knowledge verifier contract on Ethereum, sends the contract address to Bob. Bob will act as the prover, proving that he knows the solution to the zero knowledge contract on Ethereum.

This repo also includes a basic frontend to monitor the address.

ZKR abstracts the complicated process of setting up the complicated ZK-snarks setup and allows users to deploy verifiable zero knowledge proof smart contracts via a relayer / REST API.

ZKR currently only supports combination of numbers

# API
```
POST: /new

{
    "num1": <num1>,
    "num2": <num2>,
    "num3": <num3>,
    "num4": <num4>,
}

Returns:

{
  "uuid": <uuid>,
  "out1": <out1>
  "out2": <out2>
}
```

```
POST: /verifier/<uuid>

{
    "out1": <out1>,
    "out2": <out2>
}

Returns:

{
  "contractAddress": <address>
}
```

```
POST: /prover/<uuid>

{
	"num1": <num1>,
	"num2": <num2>,
	"num3": <num3>,
	"num4": <num4>,
	"contractAddress": <contract address>
} 
```