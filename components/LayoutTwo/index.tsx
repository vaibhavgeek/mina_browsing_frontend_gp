import { useEffect, useState } from "react";
import "../../pages/reactCOIServiceWorker";

import ZkappWorkerClient from "../../pages/zkappWorkerClient";

import { PublicKey, PrivateKey, Struct, Field } from "snarkyjs";
import { Box, Button, Container, Heading, Text } from "@chakra-ui/react";
import Link from "next/link";
import { Web3Storage } from "web3.storage";

class History extends Struct({
  history: [Field, Field],
}) {}

let transactionFee = 0.2;

const Layout = ({ children }: any) => {
  let [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: null as null | boolean,
    hasBeenSetup: false,
    accountExists: false,
    currentNum: null as null | Field,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    creatingTransaction: false,
  });

  // -------------------------------------------------------
  // Do Setup

  useEffect(() => {
    (async () => {
      if (!state.hasBeenSetup) {
        const zkappWorkerClient = new ZkappWorkerClient();

        console.log("Loading SnarkyJS...");
        await zkappWorkerClient.loadSnarkyJS();
        console.log("done");

        await zkappWorkerClient.setActiveInstanceToBerkeley();

        const mina = (window as any).mina;

        if (mina == null) {
          setState({ ...state, hasWallet: false });
          return;
        }

        const publicKeyBase58: string = (await mina.requestAccounts())[0];
        const publicKey = PublicKey.fromBase58(publicKeyBase58);

        console.log("using key", publicKey.toBase58());

        console.log("checking if account exists...");
        const res = await zkappWorkerClient!.fetchAccount({
          publicKey: publicKey!,
        });
        const accountExists = res.error == null;

        await zkappWorkerClient!.loadContract();

       
        console.log("compiling zkApp");
        await zkappWorkerClient!.compileContract();
        console.log("zkApp compiled");

        const zkappPublicKey = PublicKey.fromBase58(
          "B62qnV6T4Q7FvXctSdV63nB4BEC3KiTd4jZtmzEeNzPaF4LPJ3r8RbY"
        );

        await zkappWorkerClient!.initZkappInstance(zkappPublicKey);
        console.log("zk app initialised??");
        await zkappWorkerClient!.proveUpdateTransaction();

        console.log("getting Transaction JSON...");
        const transactionJSON = await zkappWorkerClient!.getTransactionJSON();
    
        console.log("requesting send transaction...");
        const { hash } = await (window as any).mina.sendTransaction({
          transaction: transactionJSON,
          feePayer: {
            fee: transactionFee,
            memo: "",
          },
        });

        console.log("getting zkApp state...");
        await zkappWorkerClient.fetchAccount({ publicKey: zkappPublicKey });
        //await zkappWorkerClient.setTopHistory();
      
        

        setState({
          ...state,
          zkappWorkerClient,
          hasWallet: true,
          hasBeenSetup: true,
          publicKey,
          zkappPublicKey,
          accountExists,
        });
      }
    })();
  }, []);

  // -------------------------------------------------------
  // Wait for account to exist, if it didn't

  useEffect(() => {
    (async () => {
      if (state.hasBeenSetup && !state.accountExists) {
        for (;;) {
          console.log("checking if account exists...");
          const res = await state.zkappWorkerClient!.fetchAccount({
            publicKey: state.publicKey!,
          });
          const accountExists = res.error == null;
          if (accountExists) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        setState({ ...state, accountExists: true });
      }
    })();
  }, [state.hasBeenSetup]);

  // -------------------------------------------------------
  // Send a transaction

  const onSendTransaction = async () => {
    setState({ ...state, creatingTransaction: true });
    console.log("sending a transaction...");

    await state.zkappWorkerClient!.fetchAccount({
      publicKey: state.publicKey!,
    });
    
  
    await state.zkappWorkerClient!.createUpdateTransactionHistory();

    
    console.log("creating proof...");
    await state.zkappWorkerClient!.proveUpdateTransaction();

    console.log("getting Transaction JSON...");
    const transactionJSON = await state.zkappWorkerClient!.getTransactionJSON();

    console.log("requesting send transaction...");
    const { hash } = await (window as any).mina.sendTransaction({
      transaction: transactionJSON,
      feePayer: {
        fee: transactionFee,
        memo: "",
      },
    });

    console.log(
      "See transaction at https://berkeley.minaexplorer.com/transaction/" + hash
    );

    setState({ ...state, creatingTransaction: false });
  };

  // -------------------------------------------------------
  // Refresh the current state

 
  // -------------------------------------------------------
  // Create UI elements

  let hasWallet;
  if (state.hasWallet != null && !state.hasWallet) {
    const auroLink = "https://www.aurowallet.com/";
    const auroLinkElem = (
      <a href={auroLink} target="_blank" rel="noreferrer">
        {" "}
        [Link]{" "}
      </a>
    );
    hasWallet = (
      <div>
        {" "}
        Could not find a wallet. Install Auro wallet here: {auroLinkElem}
      </div>
    );
  }

  let setupText = state.hasBeenSetup
    ? "SnarkyJS Ready"
    : "Setting up SnarkyJS...";
  let setup = (
    <div>
      {" "}
      {setupText} {hasWallet}
    </div>
  );

  let accountDoesNotExist;
  if (state.hasBeenSetup && !state.accountExists) {
    const faucetLink =
      "https://faucet.minaprotocol.com/?address=" + state.publicKey!.toBase58();
    accountDoesNotExist = (
      <div>
        Account does not exist. Please visit the faucet to fund this account
        <a href={faucetLink} target="_blank" rel="noreferrer">
          {" "}
          [Link]{" "}
        </a>
      </div>
    );
  }

  let mainContent;
  
  if (state.hasBeenSetup && state.accountExists) {
    mainContent = (
      <div>
        <div>
      <Container maxW={"3xl"} mt={4}>
        
      
        
        
        <Box mt={8}>
         
            <Container>
            <Button
            onClick={onSendTransaction}
              colorScheme={"teal"}
            >
              Check Validity
            </Button>
            </Container>
          
          
        </Box>
        
      </Container>
      <Box bgColor={"teal.500"} py={5} position="fixed" bottom={0} w={"100%"}>
        <Container color="white" textAlign={"center"}>
          Built with no sleep by{" "}
          <a href="https://twitter.com/recurshawn">
            <span style={{ fontWeight: "bold", textDecoration: "underline" }}>
              @recurshawn
            </span>
          </a>{" "}
          &{" "}
          <a href="https://twitter.com/vaibhavgeek">
            <span style={{ fontWeight: "bold", textDecoration: "underline" }}>
              @vaibhavgeek
            </span>
          </a>
        </Container>
      </Box>
     </div>
      </div>
    );
  }

  return (
    <Container>
      {setup}
      {accountDoesNotExist}
      {mainContent}
    </Container>
  );
};

export default Layout;
