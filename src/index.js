const express = require('express');
const bodyParser = require('body-parser');
const uuidv4 = require('uuid/v4');
const Blockchain = require('./blockchain');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const nodeIdentifier = uuidv4();

// setup a server
app.listen(process.env.PORT, () => console.log('app listening on port: ', process.env.PORT, ', identifier: ', nodeIdentifier));

// instantiate a new blockchain
let blockChain = new Blockchain();

// genesis block
blockChain.newBlock(100, 1);

// mine a new block
app.get('/mine', (req, res) => {
  let lastBlock = blockChain.lastBlock();
  let lastProof = lastBlock['proof'];
  let lastHash = lastBlock['previousHash'];
  // we are doing this to tie the transaction history with the proof
  // this way no one would be able to rewrite the transaction history from scratch.
  //  This way, proofs of work can not be recycled on other chains.
  // for reference: https://medium.com/@schubert.konstantin/isnt-there-a-msitake-with-your-proof-of-work-30cf9467f0a5
  let proof = blockChain.proofOfWork(lastProof + lastHash);

  blockChain.newTransaction('0', nodeIdentifier, 100000);
  const previousHash = blockChain.hash(lastBlock);
  console.log('previous hash while adding block: ', previousHash);
  const block = blockChain.newBlock(proof, previousHash);
  return res.send({
    message: 'new block forged',
    index: block['index'],
    transactions: block['transactions'],
    proof: block['proof'],
    previousHash: block['previousHash']
  });
});

// add a new transaction
app.post('/transactions/new', async (req, res) => {
  const requiredFields = ['sender', 'receiver', 'amount', 'broadcast'];
  let throwError = false;
  requiredFields.forEach(field => {
    if (!req.body[field] && req.body[field] !== false) {
      throwError = true;
    }
  });
  if (throwError) {
    res.status(400);
    return res.send({ message: 'required fields missing' });
  }

  let index;
  try {
    index = blockChain.newTransaction(req.body.sender, req.body.receiver, req.body.amount);
    if (req.body.broadcast) {
      await blockChain.broadcastTransaction(req.body.sender, req.body.receiver, req.body.amount);
    }
  } catch (e) {
    res.status(500);
    return res.send({ message: e.message });
  }
  return res.send({ message: `transaction will be added to block: ${index}` });
});

// get current blockChain
app.get('/chain', (req, res) => {
  return res.send({
    chain: blockChain.chain,
    length: blockChain.chain.length
  });
});

// register a new node
app.post('/nodes/register', (req, res) => {
  let body = req.body.nodes;
  if (!body.length) {
    res.status(400);
    return res.send({ message: 'please provide node addresses' });
  }
  body.forEach(node => {
    blockChain.registerNodes(node);
  });
  return res.send({
    message: 'nodes added',
    totalNodes: blockChain.nodes.join(',')
  });
});

// resolve conflicts in the chain by coming to a consensus
app.get('/nodes/resolve', async (req, res) => {
  let replaced = await blockChain.resolveConflict();
  if (replaced) {
    console.log('replaced chain in if: ', replaced);
    console.log('replaced chain in if: ', blockChain.chain);

    return res.send({
      message: 'our chain was replaced',
      newChain: blockChain.chain
    });
  } else {
    console.log('not replaced chain: ', replaced);
    console.log('not replaced chain: ', blockChain.chain);
    return res.send({
      message: 'our chain is valid',
      chain: blockChain.chain
    });
  }
});
