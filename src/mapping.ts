import { near, log, BigInt, json, JSONValueKind } from "@graphprotocol/graph-ts"
import { Log } from "../generated/schema" // ensure to add any entities you define in schema.graphql

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  
  for (let i = 0; i < actions.length; i++) {
    handleAction(
      actions[i], 
      receipt.receipt, 
      receipt.block.header,
      receipt.outcome,
      receipt.receipt.signerPublicKey
      )
  }
}

function handleAction(
  action: near.ActionValue,
  receipt: near.ActionReceipt,
  blockHeader: near.BlockHeader,
  outcome: near.ExecutionOutcome,
  publicKey: near.PublicKey
): void {
  
  if (action.kind != near.ActionKind.FUNCTION_CALL) {
    log.info("Early return: {}", ["Not a function call"]);
    return;
  }
  
  const functionCall = action.toFunctionCall();

  // change the methodName here to the methodName emitting the log in the contract
  if (functionCall.methodName == "putDID") {
    const receiptId = receipt.id.toBase58()

      // Maps the JSON formatted log to the LOG entity
      let logs = new Log(`${receiptId}`)

      // Standard receipt properties - likely do not need to change
      logs.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
      logs.blockHeight = BigInt.fromU64(blockHeader.height)
      logs.blockHash = blockHeader.hash.toBase58()
      logs.predecessorId = receipt.predecessorId
      logs.receiverId = receipt.receiverId
      logs.signerId = receipt.signerId
      logs.signerPublicKey = publicKey.bytes.toBase58()
      logs.gasBurned = BigInt.fromU64(outcome.gasBurnt)
      logs.tokensBurned = outcome.tokensBurnt
      logs.outcomeId = outcome.id.toBase58()
      logs.executorId = outcome.executorId
      logs.outcomeBlockHash = outcome.blockHash.toBase58()

      // Log parsing
      if(outcome.logs[0]!=null){
        
        let parsed = json.fromString(outcome.logs[0])
        if(parsed.kind == JSONValueKind.OBJECT){

          let entry = parsed.toObject()

          //EVENT_JSON
          let eventJSON = entry.entries[0].value.toObject()

          //standard, version, event (these stay the same for a NEP 171 emmitted log)
          for(let i = 0; i < eventJSON.entries.length; i++){
            let key = eventJSON.entries[i].key.toString()
            switch (true) {
              case key == 'standard':
                logs.standard = eventJSON.entries[i].value.toString()
                break
              case key == 'event':
                logs.event = eventJSON.entries[i].value.toString()
                break
              case key == 'version':
                logs.version = eventJSON.entries[i].value.toString()
                break
            }
          }

          //data
          let data = eventJSON.entries[0].value.toObject()
          for(let i = 0; i < data.entries.length; i++){
            let key = data.entries[i].key.toString()
            // Replace each key with the key of the data your are emitting,
            // Ensure you add the keys to the Log entity and that the types are correct
            switch (true) {
              case key == 'accountId':
                logs.accountId = data.entries[i].value.toString()
                break
              case key == 'did':
                logs.did = data.entries[i].value.toString()
                break
              case key == 'registered':
                logs.registered = data.entries[i].value.toBigInt()
                break
              case key == 'owner':
                logs.owner = data.entries[i].value.toString()
                break
            }
          }

        }
        logs.save()
      }
      
  } else {
    log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
  }
}