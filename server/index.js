const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/test', { useMongoClient: true });

const co = require('co');
const graphql = require('graphql');
const graphqlHTTP = require('express-graphql');
const graphqlTools = require('graphql-tools');
const express = require('express');
const GraphQLJSON = require('graphql-type-json');
const Member = require('./models/member');
const Product = require('./models/product');
const Order = require('./models/order');

const fs = require('fs');
const schemaString = fs.readFileSync('./schema.gql', "UTF-8");
const resolvers = {
    JSON: GraphQLJSON,
    Date: new graphql.GraphQLScalarType({
        name: "Date",
        serialize: v => v.toLocaleString(),
        parseLiteral: v => v,
        parseValue: v => new Date(v)
    }),
    Query: {
        members: function (_, { condition, skip, limit, sort }) {
            if (condition && condition.name) {
                condition.$or = [
                    { name: { $regex: condition.name, $options: 'i' } },
                    { abbr: { $regex: condition.name, $options: 'i' } }
                ]
                delete condition.name;
            }
            return Member.find(condition).skip(skip).limit(limit).sort(sort);
        },
        products: function (_, { condition, skip, limit, sort }) {
            return Product.find(condition).skip(skip).limit(limit).sort(sort);
        },
        orders: function (_, { condition, skip, limit, sort }) {
            return Order.find(condition).skip(skip).limit(limit).sort(sort);
        },
    },
    Mutation: {
        createMember: function (_, obj) {
            return new Member(obj).save();
        },
        createOrder: function (_, { memberId, details, total, note }) {
            return co(function* () {
                if (total === undefined) {
                    total = details.reduce((pre, cur) => pre + cur.price * cur.amount, 0);
                }
                let status = "NEW";
                if (memberId !== undefined) {
                    let member = yield Member.findById(memberId);
                    if (member !== null) {
                        if (member.balance >= total) {
                            member.balance -= total;
                            yield member.save();
                            status = "PAID";
                        }
                    } else {

                    }
                }
                return new Order({
                    memberId,
                    details,
                    total,
                    status,
                    note
                }).save();
            })
        },
        createProduct: function (_, obj) {
            return new Product(obj).save();
        },
        updateMember: function (_, { id, ...doc }) {
            return Member.findByIdAndUpdate(id, doc, { new: true });
        },
        updateMemberBalanceTopup: function (_, { id, amount }) {
            return Member.findByIdAndUpdate(id, { $inc: { balance: amount } }, { new: true });
        },
        updateOrderMember: function (_, { orderId, memberId }) {
            memberId = memberId || null;
            return Order.findByIdAndUpdate(orderId, { memberId }, { new: true });
        },
        updateOrderStatus: function (_, { id, status }) {
            return co(function* () {
                let order = yield Order.findById(id);
                if (order.status === 'NEW' && status === 'PAID') {
                    if (order.memberId) {
                        let member = yield Member.findById(order.memberId);
                        if (member.balance >= order.total) {
                            member.balance -= order.total;
                            yield member.save();
                            order.status = status;
                            yield order.save();
                            return order;
                        } else {
                            return new Error('user balance not enough');
                        }
                    } else {
                        // pay by cash / others out of system
                        order.status = status;
                        yield order.save();
                        return order;
                    }
                } else if (order.status === 'PAID' && status === 'NEW') {
                    // back
                    if (order.memberId) {
                        let member = yield Member.findById(order.memberId);
                        member.balance += order.total;
                        yield member.save();
                    }
                    order.status = status;
                    yield order.save();
                    return order;
                } else if (order.status === 'PAID' && status === 'FINISHED' 
                        || order.status === 'FINISHED' && status === 'PAID') {
                    order.status = status;
                    yield order.save();
                    return order;
                } else {
                    return new Error('illegal order status transfer');
                }
            });
        },
        updateProduct: function (_, { id, ...doc }) {
            return Product.findByIdAndUpdate(id, doc, { new: true });
        },
        deleteProduct: function (_, { id }) {
            return Product.findByIdAndRemove(id);
        }
    },
    Member: {
        orders: function (member) {
            return Order.find({ memberId: member.id });
        },
        birthday: function (member) {
            return member.birthday instanceof Date ? member.birthday.toLocaleDateString() : null;
        }
    },
    Order: {
        date: function (order) {
            return new Date(parseInt(order.id.slice(0, 8), 16) * 1000)
        },
        member: function (order) {
            return Order.findById(order.id).then(order => Member.findById(order.memberId));
        }
    }
};
const schema = graphqlTools.makeExecutableSchema({ typeDefs: schemaString, resolvers })

express().use(require('cors')())
    .use(graphqlHTTP({ schema: schema, pretty: true, graphiql: true }))
    .listen(3000)

console.log('Bingo API Server is running on http://localhost:3000');