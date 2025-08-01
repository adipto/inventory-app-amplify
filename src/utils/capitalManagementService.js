// src/utils/capitalManagementService.js
import { 
  ScanCommand, 
  PutItemCommand, 
  GetItemCommand, 
  UpdateItemCommand 
} from "@aws-sdk/client-dynamodb";
import { createDynamoDBClient } from "../aws/aws-config";
import { fetchStock } from "./stockService";
import { fetchRetailTransactions, fetchWholesaleTransactions } from "../api/fetchTransactions";

const CAPITAL_MANAGEMENT_TABLE = "Capital_Management";

// Initialize capital management with default values
export const initializeCapitalManagement = async (token) => {
  try {
    const client = await createDynamoDBClient(token);
    
    const getCommand = new GetItemCommand({
      TableName: CAPITAL_MANAGEMENT_TABLE,
      Key: { RecordId: { S: "MAIN_RECORD" } }
    });

    const existingRecord = await client.send(getCommand);
    
    if (!existingRecord.Item) {
      const initialRecord = {
        RecordId: { S: "MAIN_RECORD" },
        TotalCapitalInvestment: { N: "200000" },
        InitialCashInHand: { N: "200000" },
        ValueOfCurrentStock: { N: "0" },
        CashInHand: { N: "0" },
        COGSForProductSold: { N: "0" },
        SellingPrice: { N: "0" },
        NetProfit: { N: "0" },
        RemainingValueOfCurrentStock: { N: "0" },
        UpdatedStock: { N: "0" },
        LastUpdated: { S: new Date().toISOString() }
      };

      const putCommand = new PutItemCommand({
        TableName: CAPITAL_MANAGEMENT_TABLE,
        Item: initialRecord
      });

      await client.send(putCommand);
      return initialRecord;
    }

    return existingRecord.Item;
  } catch (error) {
    console.error("Error initializing capital management:", error);
    throw error;
  }
};

// Get current capital management data
export const getCapitalManagementData = async (token) => {
  try {
    const client = await createDynamoDBClient(token);
    
    const command = new GetItemCommand({
      TableName: CAPITAL_MANAGEMENT_TABLE,
      Key: { RecordId: { S: "MAIN_RECORD" } }
    });

    const response = await client.send(command);
    
    if (!response.Item) {
      return await initializeCapitalManagement(token);
    }

    return response.Item;
  } catch (error) {
    console.error("Error fetching capital management data:", error);
    throw error;
  }
};

// Update capital management data
export const updateCapitalManagementData = async (token, updates) => {
  try {
    const client = await createDynamoDBClient(token);
    
    const updateExpressions = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.keys(updates).forEach((key, index) => {
      const valueKey = `:val${index}`;
      const nameKey = `#name${index}`;
      
      updateExpressions.push(`${nameKey} = ${valueKey}`);
      expressionAttributeValues[valueKey] = updates[key];
      expressionAttributeNames[nameKey] = key;
    });

    updateExpressions.push(`#lastUpdated = :lastUpdated`);
    expressionAttributeValues[":lastUpdated"] = { S: new Date().toISOString() };
    expressionAttributeNames["#lastUpdated"] = "LastUpdated";

    const command = new UpdateItemCommand({
      TableName: CAPITAL_MANAGEMENT_TABLE,
      Key: { RecordId: { S: "MAIN_RECORD" } },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames
    });

    await client.send(command);
  } catch (error) {
    console.error("Error updating capital management data:", error);
    throw error;
  }
};

// Calculate current stock value
export const calculateCurrentStockValue = async (token) => {
  try {
    const [retailStock, wholesaleStock] = await Promise.all([
      fetchStock("Retail_Stock", token),
      fetchStock("Wholesale_Stock", token)
    ]);

    const retailTotalValue = retailStock.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    const wholesaleTotalValue = wholesaleStock.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    
    return retailTotalValue + wholesaleTotalValue;
  } catch (error) {
    console.error("Error calculating current stock value:", error);
    throw error;
  }
};

// Get last transaction data
export const getLastTransactionData = async (token) => {
  try {
    // Get ALL transactions to ensure we find the truly latest one
    const [retailTransactions, wholesaleTransactions] = await Promise.all([
      fetchRetailTransactions(token, 1000), // Get a large number to ensure we get all transactions
      fetchWholesaleTransactions(token, 1000)
    ]);

    let lastTransaction = null;
    let lastTransactionDate = null;

    // Check all retail transactions for the latest
    if (retailTransactions.items.length > 0) {
      retailTransactions.items.forEach((tx) => {
        const txDate = new Date(tx.Date);
        if (!lastTransactionDate || txDate > lastTransactionDate) {
          lastTransaction = { ...tx, type: 'retail' };
          lastTransactionDate = txDate;
        }
      });
    }

    // Check all wholesale transactions for the latest
    if (wholesaleTransactions.items.length > 0) {
      wholesaleTransactions.items.forEach((tx) => {
        const txDate = new Date(tx.Date);
        if (!lastTransactionDate || txDate > lastTransactionDate) {
          lastTransaction = { ...tx, type: 'wholesale' };
          lastTransactionDate = txDate;
        }
      });
    }

    return lastTransaction;
  } catch (error) {
    console.error("Error getting last transaction data:", error);
    throw error;
  }
};

// Calculate COGS and Selling Price for the last transaction
export const calculateLastTransactionValues = async (token) => {
  try {
    const lastTransaction = await getLastTransactionData(token);
    
    if (!lastTransaction) {
      return { cogs: 0, sellingPrice: 0 };
    }

    let totalCOGS = 0;
    let totalSellingPrice = 0;

    if (lastTransaction.type === 'retail') {
      const quantity = parseInt(lastTransaction.Quantity_Pcs) || 0;
      const cogsPerPiece = parseFloat(lastTransaction.COGS_Per_Pc) || 0;
      const sellingPricePerPiece = parseFloat(lastTransaction.SellingPrice_Per_Pc) || 0;

      totalCOGS = quantity * cogsPerPiece;
      totalSellingPrice = quantity * sellingPricePerPiece;
      
    } else {
      const quantity = parseInt(lastTransaction.Quantity_Packets) || 0;
      const cogsPerPiece = parseFloat(lastTransaction.COGS_Per_Packet) || 0; // This is actually COGS per piece
      const sellingPricePerPacket = parseFloat(lastTransaction.SellingPrice_Per_Packet) || 0;

      const piecesPerPacket = 500;
      totalCOGS = quantity * piecesPerPacket * cogsPerPiece; // COGS per piece * 500 pieces per packet * quantity
      totalSellingPrice = quantity * sellingPricePerPacket;
    }

    return { 
      cogs: Math.max(0, totalCOGS), 
      sellingPrice: Math.max(0, totalSellingPrice) 
    };
    
  } catch (error) {
    console.error("Error calculating last transaction values:", error);
    return { cogs: 0, sellingPrice: 0 };
  }
};

// Update capital management after a new transaction
export const updateAfterTransaction = async (token) => {
  try {
    const currentData = await getCapitalManagementData(token);
    const { cogs, sellingPrice } = await calculateLastTransactionValues(token);
    const currentStockValue = await calculateCurrentStockValue(token);

    const netProfit = sellingPrice - cogs;
    const remainingStockValue = Math.max(0, currentStockValue - cogs);
    const currentCashInHand = parseFloat(currentData.CashInHand?.N || "0");
    const newCashInHand = currentCashInHand + sellingPrice;

    const updates = {
      ValueOfCurrentStock: { N: currentStockValue.toString() },
      CashInHand: { N: newCashInHand.toString() },
      COGSForProductSold: { N: cogs.toString() },
      SellingPrice: { N: sellingPrice.toString() },
      NetProfit: { N: netProfit.toString() },
      RemainingValueOfCurrentStock: { N: remainingStockValue.toString() }
    };

    await updateCapitalManagementData(token, updates);
  } catch (error) {
    console.error("Error updating capital management after transaction:", error);
    // Don't throw error to avoid breaking the main transaction flow
  }
};

// Update capital management after new stock is added
export const updateAfterStockAddition = async (token) => {
  try {
    const currentData = await getCapitalManagementData(token);
    const currentStockValue = await calculateCurrentStockValue(token);
    
    const previousStockValue = parseFloat(currentData.ValueOfCurrentStock?.N || "0");
    const newlyBoughtStock = Math.max(0, currentStockValue - previousStockValue);
    const currentCashInHand = parseFloat(currentData.CashInHand?.N || "0");
    const newCashInHand = Math.max(0, currentCashInHand - newlyBoughtStock);

    const updates = {
      ValueOfCurrentStock: { N: currentStockValue.toString() },
      CashInHand: { N: newCashInHand.toString() },
      UpdatedStock: { N: newlyBoughtStock.toString() }
    };

    await updateCapitalManagementData(token, updates);
  } catch (error) {
    console.error("Error updating capital management after stock addition:", error);
    // Don't throw error to avoid breaking the main stock addition flow
  }
};

// Refresh all capital management calculations
export const refreshCapitalManagement = async (token) => {
  try {
    const currentStockValue = await calculateCurrentStockValue(token);
    const { cogs, sellingPrice } = await calculateLastTransactionValues(token);
    const netProfit = sellingPrice - cogs;
    const remainingStockValue = Math.max(0, currentStockValue - cogs);

    const updates = {
      ValueOfCurrentStock: { N: currentStockValue.toString() },
      COGSForProductSold: { N: cogs.toString() },
      SellingPrice: { N: sellingPrice.toString() },
      NetProfit: { N: netProfit.toString() },
      RemainingValueOfCurrentStock: { N: remainingStockValue.toString() }
    };

    await updateCapitalManagementData(token, updates);
  } catch (error) {
    console.error("Error refreshing capital management:", error);
    throw error;
  }
}; 