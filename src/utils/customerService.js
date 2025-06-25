// src/utils/customerService.js
import { ScanCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { createDynamoDBClient } from "../aws/aws-config";

export const fetchCustomers = async () => {
    const client = await createDynamoDBClient();

    const command = new ScanCommand({
        TableName: "Customer_Information",
    });

    const response = await client.send(command);

    const customers = response.Items?.map((item) => ({
        CustomerID: item.CustomerID.S,
        Name: item.Name?.S || "",
        Address: item.Address?.S || "",
        CustomerType: item.CustomerType?.S || "",
        Email: item.Email?.S || "",
        PhoneNumber: item.PhoneNumber?.S || "",
    })) || [];

    return customers;
};

export const deleteCustomer = async (customerId) => {
    const client = await createDynamoDBClient();

    const command = new DeleteItemCommand({
        TableName: "Customer_Information",
        Key: {
            CustomerID: { S: customerId },
        },
    });

    await client.send(command);
};
