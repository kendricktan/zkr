# zkr
ZoKrates Relayer (Zero Knowledge Relayer)

# Use-case
Adam owns a lock, and Bob wants to prove that he knows the combination of the lock to Adam. They decided to do that through Ethereum.
The problem with deploying a contract that checks if Bob knows the combination of Adam's lock is that you'll need to pass in the combination
of the lock somewhere in the contract, which is a big nono.

We can avoid putting the actual combination of Adam's lock online by using Zero Knowledge Proofs.

(Contract is a one time use thing)