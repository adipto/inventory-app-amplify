// src/api/fetchTransactions.js
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { createDynamoDBClient } from "../aws/aws-config";
import { fetchAuthSession } from "aws-amplify/auth";

// Fetch retail transactions
export const fetchRetailTransactions = async () => {
    try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        const client = createDynamoDBClient(idToken);

        const command = new ScanCommand({ TableName: "Transaction_Retail" });
        const response = await client.send(command);

        return response.Items.map(item => unmarshall(item));
    } catch (error) {
        console.error("Error fetching retail transactions:", error);
        throw error;
    }
};

// Fetch wholesale transactions
export const fetchWholesaleTransactions = async () => {
    try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        const client = createDynamoDBClient(idToken);

        const command = new ScanCommand({ TableName: "Transaction_Wholesale" });
        const response = await client.send(command);

        return response.Items.map(item => unmarshall(item));
    } catch (error) {
        console.error("Error fetching wholesale transactions:", error);
        throw error;
    }
};

// Fetch customer details
export const fetchCustomerDetails = async (customerIds) => {
    if (!customerIds || customerIds.length === 0) return {};

    try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        const client = createDynamoDBClient(idToken);

        const command = new ScanCommand({ TableName: "Customer_Information" });
        const response = await client.send(command);

        const customers = response.Items.map(item => unmarshall(item));
        const customerMap = {};

        customers.forEach(customer => {
            customerMap[customer.CustomerID] = customer;
        });

        return customerMap;
    } catch (error) {
        console.error("Error fetching customer details:", error);
        throw error;
    }
};
