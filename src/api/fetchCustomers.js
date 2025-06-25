// src/api/fetchCustomers.js
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { createDynamoDBClient } from "../aws-config";

export const fetchCustomers = async (idToken) => {
    const client = createDynamoDBClient(idToken);

    const command = new ScanCommand({
        TableName: "Customer_Information",
    });

    const response = await client.send(command);

    return response.Items.map((item) => ({
        CustomerID: item.CustomerID.S,
        Name: item.Name.S,
        Address: item.Address.S,
        CustomerType: item.CustomerType.S,
        Email: item.Email.S,
        PhoneNumber: item.PhoneNumber.S,
    }));
};
