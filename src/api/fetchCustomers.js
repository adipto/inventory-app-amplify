// src/api/fetchCustomers.js
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { createDynamoDBClient } from "../aws/aws-config";

export const fetchCustomers = async (idToken, limit = 10, startKey = null) => {
    const client = createDynamoDBClient(idToken);

    const params = {
        TableName: "Customer_Information",
        Limit: limit,
    };
    if (startKey) {
        params.ExclusiveStartKey = startKey;
    }

    const command = new ScanCommand(params);
    const response = await client.send(command);

    return {
        items: response.Items.map((item) => ({
            CustomerID: item.CustomerID.S,
            Name: item.Name.S,
            Address: item.Address.S,
            CustomerType: item.CustomerType.S,
            Email: item.Email.S,
            PhoneNumber: item.PhoneNumber.S,
        })),
        lastEvaluatedKey: response.LastEvaluatedKey || null,
    };
};
