const express = require("express");
const os = require("os");
const fetch = require("node-fetch");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = 2601 ;

const dbModule = require("./mydb/users");
const db = dbModule.db;

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.set('trust proxy', 1);

app.get("/", (req, res) => {
    res.send("Server Running");
});
/*------------------------------------------------*/

const routes = ["auth","courses","admin/users","admin/assistant","admin/courses"];

routes.forEach(route => {
    app.use(`/api/${route}`, require(`./routes/${route}`));
});

/*------------------------------------------------*/
app.get("/users", (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const parsedUsers = rows.map(user => ({
            ...user
        }));

        res.json({
            success: true,
            users: parsedUsers
        });
    });
});
app.get("/users/wallet/add/:phone_number/:amount", (req, res) => {
    const { phone_number, amount } = req.params;

    const value = Number(amount);

    if (isNaN(value) || value <= 0) {
        return res.status(400).json({
            success: false,
            error: "Invalid amount"
        });
    }

    db.run(
        "UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + ? WHERE phone_number = ?",
        [value, phone_number],
        function (err) {
            if (err) {
                return res.status(500).json({
                    success: false,
                    error: err.message
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: "User not found"
                });
            }

            db.get(
                "SELECT * FROM users WHERE phone_number = ?",
                [phone_number],
                (err, user) => {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            error: err.message
                        });
                    }

                    res.json({
                        success: true,
                        message: "Wallet balance updated successfully",
                        user
                    });
                }
            );
        }
    );
});
/*------------------------------------------------*/
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server started!");
    console.log("Port:", PORT);
    console.log("Server IP: http://108.181.221.18:" + PORT);
});
