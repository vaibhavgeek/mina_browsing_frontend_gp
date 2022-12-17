import {
  Mina,
  isReady,
  PublicKey,
  PrivateKey,
  Field,
  fetchAccount,
  Struct
} from "snarkyjs";

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import type { MatchMeBetter } from "./../../circuits/build/src";
import { transaction } from "snarkyjs/dist/node/lib/mina";

const state = {
  MatchMeBetter: null as null | typeof MatchMeBetter,
  zkapp: null as null | MatchMeBetter,
  transaction: null as null | Transaction,
};

// ---------------------------------------------------------------------------------------
class History extends Struct({
  history: [Field, Field],
}) {}

class TopHistory extends Struct({
  top: [History, History]
}){} 

const functions = {
  loadSnarkyJS: async (args: {}) => {
    await isReady;
  },
  setActiveInstanceToBerkeley: async (args: {}) => {
    const Berkeley = Mina.BerkeleyQANet(
      "https://proxy.berkeley.minaexplorer.com/graphql"
    );
    Mina.setActiveInstance(Berkeley);
  },
  loadContract: async (args: {}) => {
    const { MatchMeBetter } = await import("./../../circuits/build/src/matchbetter");
    state.MatchMeBetter = MatchMeBetter;
  },
  compileContract: async (args: {}) => {
    await state.MatchMeBetter!.compile();
  },
  fetchAccount: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey });
  },
  initZkappInstance: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.MatchMeBetter!(publicKey);
    //let history = new History({history: [new Field(1), new Field(3)]});
    let counter = new Field(22);
    let domain = new Field(100);
    const transaction = await Mina.transaction(() => {
      state.zkapp!.initState(counter,domain);
    });
    state.transaction = transaction; 
  },
  setTopHistory: async (args: {}) => {
    let basicHistoryOne = new History({history: [new Field(34), new Field(100)]});
    let basicHistoryTwo = new History({history: [new Field(88), new Field(100)]});
    let topHistory = new TopHistory({top: [basicHistoryOne, basicHistoryTwo]});
    const history = await state.zkapp!.setTopHistory(topHistory);
    return history;
  },
  checkCredit: async (args: {}) => {
   const status = await state.zkapp!.checkCredit();
   return status;
  },
  createUpdateTransaction: async (args: {}) => {
    let basicHistoryOne = new History({history: [new Field(34), new Field(100)]});
    let basicHistoryTwo = new History({history: [new Field(88), new Field(100)]});
    let topHistory = new TopHistory({top: [basicHistoryOne, basicHistoryTwo]})
    const transaction = await Mina.transaction(() => {
        state.zkapp!.setTopHistory(topHistory);
      }
    );
    state.transaction = transaction;
  },
  createUpdateTransactionHistory: async(args: {}) =>{
    const transaction = await Mina.transaction(() => {
      state.zkapp!.checkCredit();
    }
  );
  state.transaction = transaction;
  },
  proveUpdateTransaction: async (args: {}) => {
    console.log("transaction", await state.transaction!.prove());
    
    await state.transaction!.prove();
  },
  getTransactionJSON: async (args: {}) => {
    return state.transaction!.toJSON();
  },
};

// ---------------------------------------------------------------------------------------

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number;
  fn: WorkerFunctions;
  args: any;
};

export type ZkappWorkerReponse = {
  id: number;
  data: any;
};
if (process.browser) {
  addEventListener(
    "message",
    async (event: MessageEvent<ZkappWorkerRequest>) => {
      const returnData = await functions[event.data.fn](event.data.args);

      const message: ZkappWorkerReponse = {
        id: event.data.id,
        data: returnData,
      };
      postMessage(message);
    }
  );
}
