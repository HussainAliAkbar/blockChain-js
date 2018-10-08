const express = require('express');
const bodyParser = require('body-parser');
const uuidv4 = require('uuid/v4');
const Blockchain = require('./blockchain');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
let blockChain = new Blockchain();
// genesis block
blockChain.newBlock(100, 1);
const nodeIdentifier = uuidv4();

app.get('/mine', (req, res) => {
  let lastBlock = blockChain.lastBlock();
  let lastProof = lastBlock['proof'];
  console.log('last block: ', lastBlock);
  console.log('last proof: ', lastProof);
  let proof = blockChain.proofOfWork(lastProof);
  console.log('new proof: ', proof);

  blockChain.newTransaction('0', nodeIdentifier, 100000);
  const previousHash = blockChain.hash(lastBlock);
  console.log('previous hash while adding block: ', previousHash);
  const block = blockChain.newBlock(proof, previousHash);
  res.send({
    message: 'new block forged',
    index: block['index'],
    transactions: block['transactions'],
    proof: block['proof'],
    previousHash: block['previousHash']
  });
});

app.post('/transactions/new', (req, res) => {
  const requiredFields = ['sender', 'receiver', 'amount'];
  requiredFields.forEach(field => {
    if (!req.body[field]) {
      res.status(400);
      res.send({ message: 'required fields missing' });
    }
  });
  let index = blockChain.newTransaction(req.body.sender, req.body.receiver, req.body.amount);
  res.send({ message: `transaction will be added to block: ${index}` });
});

app.get('/chain', (req, res) => {
  res.send({
    chain: blockChain.chain,
    length: blockChain.chain.length
  });
});

app.post('/nodes/register', (req, res) => {
  let body = req.body.nodes;
  if (!body.length) {
    res.status(400);
    res.send({ message: 'please provide node addresses' });
  }
  body.forEach(node => {
    blockChain.registerNodes(node);
  });
  res.send({
    message: 'nodes added',
    totalNodes: blockChain.nodes.join(',')
  });
});

app.get('/nodes/resolve', async (req, res) => {
  let replaced = await blockChain.resolveConflict();
  if (replaced) {
    console.log('replaced chain in if: ', replaced);
    console.log('replaced chain in if: ', blockChain.chain);

    res.send({
      message: 'our chain was replaced',
      newChain: blockChain.chain
    });
  } else {
    console.log('not replaced chain: ', replaced);
    console.log('not replaced chain: ', blockChain.chain);
    res.send({
      message: 'our chain is valid',
      chain: blockChain.chain
    });
  }
});

app.listen(process.env.PORT, () => console.log('app listening on port: ', process.env.PORT));
