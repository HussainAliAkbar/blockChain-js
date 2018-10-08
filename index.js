// https://hackernoon.com/learn-blockchains-by-building-one-117428612f46
const SHA256 = require("crypto-js/sha256");
const axios = require('axios');
const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const uuidv4 = require('uuid/v4');

const getUTCTimeString = () => Math.round(new Date().getTime() / 1000).toString();
class Blockchain {
  constructor() {
    this.chain = [];
    this.currentTransactions = [];
    this.nodes = [];
  }


  registerNodes(address) {
    /*
         Add a new node to the list of nodes
        :param address: <str> Address of node. Eg. 'http://192.168.0.5:5000'
        :return: None
     */
    if (!_.includes(this.nodes, address)) {
      console.log('adding new node');
      this.nodes.push(address);
    } else {
      console.log('node already added');
    }
  }

  validChain(chain) {
    /*
        Determine if a given blockchain is valid
        :param chain: <list> A blockchain
        :return: <bool> True if valid, False if not
     */
    // console.log('validating chain: ', chain);
    let lastBlock = chain[0];
    let currentIndex = 1;

    while (currentIndex < chain.length) {
      let block = chain[currentIndex];
      // console.log('last block: ', lastBlock);
      // console.log('block: ', block);
      // console.log('-----------');
      // Check that the hash of the block is correct
      // console.log(this.hash(lastBlock));
      if (block['previousHash'] !== this.hash(lastBlock)) {
        // console.log('returning false from 1st of');
        return false;
      }
      // check that proof of work is correct
      if (!this.validProof(lastBlock['proof'], block['proof'])) {
        // console.log('returning false from 2nd if')
        return false;
      }

      lastBlock = block;
      currentIndex+=1;
    }
    // console.log('returning true');
    return true;
  }

  async resolveConflict() {
    // console.log();
    /*
        This is our Consensus Algorithm, it resolves conflicts
        by replacing our chain with the longest one in the network.
        :return: <bool> True if our chain was replaced, False if not
     */

    let neighbours = this.nodes;
    let newChain = undefined;

    // We're only looking for chains longer than ours
    let maxLength = this.chain.length;
    // console.log('length of this chain is: ', maxLength);

    let promises = [];
    for (let i = 0; i < neighbours.length; i++) {
      promises.push(axios.get(`http://${neighbours[i]}/chain`));
    }

    let responses = await Promise.all(promises);

    // console.log(responses[0].data)
    responses.forEach(res => {
      let length = res.data.length;
      let chain  = res.data.chain;

      //Check if the length is longer and the chain is valid
      if (length > maxLength && this.validChain(chain)) {
        console.log('the other chain is valid')
        maxLength = length;
        newChain = chain;
      }

    });

    if (newChain) {
      console.log('replacing old chain with new chain');
      console.log('old chain: ', this.chain);
      console.log('new chain: ', newChain);
      this.chain = newChain;
      console.log('replaced chain: ', this.chain);
      // this.chain = newChain;
      return true;
    }
    console.log('chain not replaced');
    return false;
  }

  newBlock(proof, previousHash = null) {
    /*
        Create a new Block in the Blockchain
        :param proof: <int> The proof given by the Proof of Work algorithm
        :param previous_hash: (Optional) <str> Hash of previous Block
        :return: <dict> New Block
     */
    const block = {
        'index': this.chain.length + 1,
        'timestamp': getUTCTimeString(),
        // 'timestamp': new Date(),
        'transactions': this.currentTransactions,
        'proof': proof,
        'previousHash': previousHash || this.hash(_.last(this.chain)),
    };

    this.currentTransactions = [];
    this.chain.push(block);
    return block;

  }

  newTransaction(sender, receiver, amount) {
    /*
        Creates a new transaction to go into the next mined Block
        :param sender: <str> Address of the Sender
        :param recipient: <str> Address of the Recipient
        :param amount: <int> Amount
        :return: <int> The index of the Block that will hold this transaction
    */
    this.currentTransactions.push({
      sender,
      receiver,
      amount
    });
    return this.lastBlock()['index'] + 1;
  }

  lastBlock() {
    return _.last(this.chain);
  }


  hash(block) {
    // return SHA256(block.index + block.transactions + block.proof + block.previousHash).toString();
    return SHA256(block.index + block.timestamp + block.transactions + block.proof + block.previousHash).toString();
  }

  proofOfWork(lastProof) {
    /*
        Simple Proof of Work Algorithm:
         - Find a number p' such that hash(pp') contains leading 4 zeroes, where p is the previous p'
         - p is the previous proof, and p' is the new proof
        :param last_proof: <int>
        :return: <int>
     */

    let proof = 0;
    while (this.validProof(lastProof, proof) !== true) {
      proof +=1;
    }
    console.log('found proof');
    return proof;
  }

  validProof(lastProof, proof) {
    /*
        Validates the Proof: Does hash(last_proof, proof) contain 4 leading zeroes?
        :param last_proof: <int> Previous Proof
        :param proof: <int> Current Proof
        :return: <bool> True if correct, False if not.
     */
    let guess = SHA256(lastProof.toString() + proof.toString()).toString();

    return guess.substr(guess.length - 2) === '00'; // 2 is the difficulty
  }


}

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
let blockChain = new Blockchain();
//genesis block
blockChain.newBlock(100, 1);
const nodeIdentifier = uuidv4();

app.get('/mine', (req, res) => {
  let lastBlock = blockChain.lastBlock()
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
      res.send({message: 'required fields missing'});
    }
  });
  let index = blockChain.newTransaction(req.body.sender, req.body.receiver, req.body.amount);
  res.send({message: `transaction will be added to block: ${index}`});
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
    res.send({message: 'please provide node addresses'});
  }
  body.forEach(node => {
    blockChain.registerNodes(node);
  });
  res.send({
    message: 'nodes added',
    totalNodes: blockChain.nodes.join(',')
  });
});

app.get('/nodes/resolve', async (req,res) => {
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