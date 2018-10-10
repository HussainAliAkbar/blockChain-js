const SHA256 = require('crypto-js/sha256');
const axios = require('axios');
const _ = require('lodash');
const utils = require('./utils');

module.exports = class Blockchain {
  constructor () {
    this.chain = [];
    this.currentTransactions = [];
    this.nodes = [];
  }

  registerNodes (address) {
    if (!_.includes(this.nodes, address)) {
      console.log('adding new node');
      this.nodes.push(address);
    } else {
      console.log('node already added');
    }
  }

  validChain (chain) {
    let lastBlock = chain[0];
    let currentIndex = 1;

    while (currentIndex < chain.length) {
      let block = chain[currentIndex];
      // Check that the hash of the block is correct
      if (block['previousHash'] !== this.hash(lastBlock)) {
        return false;
      }
      // check that proof of work is correct

      // we are doing this to tie the transaction history with the proof
      // this way no one would be able to rewrite the transaction history from scratch.
      //  This way, proofs of work can not be recycled on other chains.
      // for reference: https://medium.com/@schubert.konstantin/isnt-there-a-msitake-with-your-proof-of-work-30cf9467f0a5

      let lastProof =lastBlock['proof'] + lastBlock['previousHash'];
      if (!this.validProof(lastProof, block['proof'])) {
        return false;
      }

      lastBlock = block;
      currentIndex += 1;
    }
    return true;
  }

  async resolveConflict () {
    let neighbours = this.nodes;
    let newChain;

    // We're only looking for chains longer than ours
    let maxLength = this.chain.length;

    let promises = [];
    for (let i = 0; i < neighbours.length; i++) {
      promises.push(axios.get(`http://${neighbours[i]}/chain`));
    }

    let responses = await Promise.all(promises);

    responses.forEach(res => {
      let length = res.data.length;
      let chain = res.data.chain;

      // Check if the length is longer and the chain is valid
      if (length > maxLength && this.validChain(chain)) {
        console.log('the other chain is valid');
        maxLength = length;
        newChain = chain;
      }
    });

    if (newChain) {
      console.log('replacing old chain with new chain');
      this.chain = newChain;
      console.log('replaced chain: ', this.chain);
      // this.chain = newChain;
      return true;
    }
    console.log('chain not replaced');
    return false;
  }

  newBlock (proof, previousHash = null) {
    const block = {
      'index': this.chain.length + 1,
      'timestamp': utils.getUTCTimeString(),
      'transactions': this.currentTransactions,
      'proof': proof,
      'previousHash': previousHash || this.hash(_.last(this.chain))
    };

    this.currentTransactions = [];
    this.chain.push(block);
    return block;
  }

  newTransaction (sender, receiver, amount) {
    this.currentTransactions.push({
      sender,
      receiver,
      amount
    });
    return this.lastBlock()['index'] + 1;
  }

  async broadcastTransaction (sender, receiver, amount) {
    console.log('broadcasting transactions');
    let neighbours = this.nodes;
    let promises = [];
    for (let i = 0; i < neighbours.length; i++) {
      promises.push(axios.post(`http://${neighbours[i]}/transactions/new`, {
        sender,
        receiver,
        amount,
        broadcast: false
      }));
    }
    try {
      await Promise.all(promises);
      return Promise.resolve(true);
    } catch (e) {
      return Promise.reject(new Error(`failed to broadcast transaction: ${e.response.data.message}`));
    }
  }

  lastBlock () {
    return _.last(this.chain);
  }

  hash (block) {
    return SHA256(block.index + block.timestamp + block.transactions + block.proof + block.previousHash).toString();
  }

  proofOfWork (lastProof) {
    let proof = 0;
    while (this.validProof(lastProof, proof) !== true) {
      proof += 1;
    }
    console.log('found proof');
    return proof;
  }

  validProof (lastProof, proof) {
    let guess = SHA256(lastProof.toString() + proof.toString()).toString();
    return guess.substr(guess.length - 2) === '00'; // 2 is the difficulty
  }
};
