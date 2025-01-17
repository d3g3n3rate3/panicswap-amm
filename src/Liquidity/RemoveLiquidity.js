import React, { useEffect } from "react";
import { Grid, makeStyles, Paper, Typography } from "@material-ui/core";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";
import { useSnackbar } from "notistack";
import {
  getAccount,
  getFactory,
  getProvider,
  getRouter,
  getSigner,
  getBalanceAndSymbol,
  getWeth,
  getReserves,
  getNetwork,
} from "../ethereumFunctions";
import { removeLiquidity, quoteRemoveLiquidity } from "./LiquidityFunctions";
import {
  RemoveLiquidityField1,
  RemoveLiquidityField2,
} from "../CoinSwapper/CoinField";
import CoinDialog from "../CoinSwapper/CoinDialog";
import LoadingButton from "../Components/LoadingButton";
import WrongNetwork from "../Components/wrongNetwork";
import COINS from "../constants/coins";
import * as chains from "../constants/chains";

const styles = (theme) => ({
  paperContainer: {
    borderRadius: theme.spacing(2),
    padding: theme.spacing(2),
    width: "40%",
    overflow: "wrap",
    background: "#e5e5e5",
  },
  fullWidth: {
    width: "100%",
  },
  values: {
    width: "50%",
  },
  title: {
    textAlign: "center",
    padding: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
  },
  hr: {
    width: "100%",
  },
  balance: {
    padding: theme.spacing(1),
    overflow: "wrap",
    textAlign: "center",
  },
  buttonIcon: {
    marginRight: theme.spacing(1),
    padding: theme.spacing(0.4),
  },
  rightSideBottomText: {
    textAlign: "right",
  },
  leftSideBottomText: {
    textAlign: "left",
  },
  liquidityIcon: {
    width: "20px",
    marginLeft: "3px",
    marginBottom: "5px",
  },
});

const useStyles = makeStyles(styles);

function LiquidityRemover(props) {
  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();

  const [provider, setProvider] = React.useState(getProvider());
  const [signer, setSigner] = React.useState(getSigner(provider));

  // The following are populated in a react hook
  const [account, setAccount] = React.useState(undefined);
  const [chainId, setChainId] = React.useState(undefined);
  const [router, setRouter] = React.useState(undefined);
  const [weth, setWeth] = React.useState(undefined);
  const [factory, setFactory] = React.useState(undefined);

  // Stores a record of whether their respective dialog window is open
  const [dialog1Open, setDialog1Open] = React.useState(false);
  const [dialog2Open, setDialog2Open] = React.useState(false);
  const [wrongNetworkOpen, setwrongNetworkOpen] = React.useState(false);

  const [maxValue, setMaxValue] = React.useState(0);
  const [maxWeiValue, setMaxWeiValue] = React.useState(0);

  // Stores data about their respective coin
  const [coin1, setCoin1] = React.useState({
    address: undefined,
    symbol: undefined,
    balance: undefined,
    wei: undefined,
  });
  const [coin2, setCoin2] = React.useState({
    address: undefined,
    symbol: undefined,
    balance: undefined,
    wei: undefined,
  });

  const [coins, setCoins] = React.useState([]);

  // Stores the current reserves in the liquidity pool between coin1 and coin2
  const [reserves, setReserves] = React.useState(["0.0", "0.0"]);

  // Stores the current value of their respective text box
  const [field1Value, setField1Value] = React.useState("");

  // Controls the loading button
  const [loading, setLoading] = React.useState(false);

  // Stores the liquidity tokens balance of the user
  const [liquidityTokens, setLiquidityTokens] = React.useState("");
  const [liquidityTokensWei, setLiquidityTokensWei] = React.useState("");

  // Stores the input and output for the liquidity removal preview
  const [tokensOut, setTokensOut] = React.useState([0, 0, 0]);

  // Switches the top and bottom coins, this is called when users hit the swap button or select the opposite
  // token in the dialog (e.g. if coin1 is TokenA and the user selects TokenB when choosing coin2)
  const switchFields = () => {
    setCoin1(coin2);
    setCoin2(coin1);
    setReserves(reserves.reverse());
  };

  // These functions take an HTML event, pull the data out and puts it into a state variable.
  const handleChange = {
    field1: (e) => {
      setField1Value(e.target.value);
    },
  };

  // Turns the account's balance into something nice and readable
  const formatBalance = (balance, symbol) => {
    if (balance && symbol)
      return parseFloat(balance).toPrecision(8) + " " + symbol;
    else return "0.0";
  };

  // Turns the coin's reserves into something nice and readable
  const formatReserve = (reserve, symbol) => {
    if (reserve && symbol) return reserve + " " + symbol;
    else return "0.0";
  };

  // Determines whether the button should be enabled or not
  const isButtonEnabled = () => {
    // If both coins have been selected, and a valid float has been entered for both, which are less than the user's balances, then return true
    const parsedInput = parseFloat(field1Value);
    return (
      coin1.address &&
      coin2.address &&
      Number.isFinite(parsedInput) &&
      0 < parsedInput &&
      parsedInput <= liquidityTokens
    );
  };

  const remove = () => {
    console.log("Attempting to remove liquidity...");
    setLoading(true);

    removeLiquidity(
      coin1.address,
      coin2.address,
      field1Value,
      0, // todo frontrunning
      0,
      router,
      account,
      signer,
      factory
    )
      .then(() => {
        setLoading(false);

        // If the transaction was successful, we clear to input to make sure the user doesn't accidental redo the transfer
        setField1Value("");
        enqueueSnackbar("Removal Successful", { variant: "success" });
      })
      .catch((e) => {
        setLoading(false);
        enqueueSnackbar("Deployment Failed (" + e.message + ")", {
          variant: "error",
          autoHideDuration: 10000,
        });
      });
  };

  // Called when the dialog window for coin1 exits
  const onToken1Selected = (address) => {
    // Close the dialog window
    setDialog1Open(false);

    // If the user inputs the same token, we want to switch the data in the fields
    if (address === coin2.address) {
      switchFields();
    }
    // We only update the values if the user provides a token
    else if (address) {
      // Getting some token data is async, so we need to wait for the data to return, hence the promise
      getBalanceAndSymbol(
        account,
        address,
        provider,
        signer,
        weth.address,
        coins
      ).then((data) => {
        setCoin1({
          address: address,
          symbol: data.symbol,
          balance: data.balance,
          wei: data.wei,
        });
      });
    }
  };

  // Called when the dialog window for coin2 exits
  const onToken2Selected = (address) => {
    // Close the dialog window
    setDialog2Open(false);

    // If the user inputs the same token, we want to switch the data in the fields
    if (address === coin1.address) {
      switchFields();
    }
    // We only update the values if the user provides a token
    else if (address) {
      // Getting some token data is async, so we need to wait for the data to return, hence the promise
      getBalanceAndSymbol(
        account,
        address,
        provider,
        signer,
        weth.address,
        coins
      ).then((data) => {
        setCoin2({
          address: address,
          symbol: data.symbol,
          balance: data.balance,
          wei: data.wei,
        });
      });
    }
  };

  // This hook is called when either of the state variables `coin1.address` or `coin2.address` change.
  // This means that when the user selects a different coin to convert between, or the coins are swapped,
  // the new reserves will be calculated.
  useEffect(() => {
    console.log(
      "Trying to get reserves M1 between:\n" +
        coin1.address +
        "\n" +
        coin2.address
    );

    if (coin1.address && coin2.address && account) {
      getReserves(coin1.address, coin2.address, factory, signer, account).then(
        (data) => {
          setReserves([data[0], data[1]]);
          setLiquidityTokens(data[2]);
          setLiquidityTokensWei(data[3]);
        }
      );
    }
  }, [coin1.address, coin2.address, account, factory, signer]);

  // This hook is called when either of the state variables `field1Value`, `coin1.address` or `coin2.address` change.
  // It will give a preview of the liquidity removal.
  useEffect(() => {
    if (isButtonEnabled()) {
      console.log("Trying to preview the liquidity removal");

      quoteRemoveLiquidity(
        coin1.address,
        coin2.address,
        field1Value,
        factory,
        signer
      ).then((data) => {
        setTokensOut(data);
      });
    }
  }, [coin1.address, coin2.address, field1Value, factory, signer]);

  useEffect(() => {
    // This hook creates a timeout that will run every ~10 seconds, it's role is to check if the user's balance has
    // updated has changed. This allows them to see when a transaction completes by looking at the balance output.

    const coinTimeout = setTimeout(() => {
      console.log("Checking balances & Getting reserves...");

      if (coin1.address && coin2.address && account) {
        getReserves(
          coin1.address,
          coin2.address,
          factory,
          signer,
          account
        ).then((data) => {
          setReserves([data[0], data[1]]);
          setLiquidityTokens(data[2]);
          setLiquidityTokensWei(data[3]);
        });
      }

      if (coin1.address && account && !wrongNetworkOpen) {
        getBalanceAndSymbol(
          account,
          coin1.address,
          provider,
          signer,
          weth.address,
          coins
        ).then((data) => {
          setCoin1({
            ...coin1,
            balance: data.balance,
            wei: data.wei,
          });
        });
      }
      if (coin2.address && account && !wrongNetworkOpen) {
        getBalanceAndSymbol(
          account,
          coin2.address,
          provider,
          signer,
          weth.address,
          coins
        ).then((data) => {
          setCoin2({
            ...coin2,
            balance: data.balance,
            wei: data.wei,
          });
        });
      }
    }, 10000);

    return () => clearTimeout(coinTimeout);
  });

  useEffect(() => {
    getAccount().then((account) => {
      setAccount(account);
    });

    async function Network() {
      const chainId = await getNetwork(provider).then((chainId) => {
        setChainId(chainId);
        return chainId;
      });

      if (chains.networks.includes(chainId)) {
        setwrongNetworkOpen(false);
        console.log("chainID: ", chainId);
        // Get the router using the chainID
        const router = await getRouter(
          chains.routerAddress.get(chainId),
          signer
        );
        setRouter(router);
        // Get Weth address from router
        await router.weth().then((wethAddress) => {
          setWeth(getWeth(wethAddress, signer));
          // Set the value of the weth address in the default coins array
          const coins = COINS.get(chainId);
          setCoins(coins);
        });
        // Get the factory address from the router
        await router.factory().then((factory_address) => {
          setFactory(getFactory(factory_address, signer));
        });
      } else {
        console.log("Wrong network mate.");
        setwrongNetworkOpen(true);
      }
    }

    Network();
  }, [provider, signer]);

  return (
    <div>
      {/* Coin Swapper */}
      <Typography variant="h5" className={classes.title}></Typography>

      {/* Dialog Windows */}
      <CoinDialog
        open={dialog1Open}
        onClose={onToken1Selected}
        coins={coins}
        signer={signer}
      />
      <CoinDialog
        open={dialog2Open}
        onClose={onToken2Selected}
        coins={coins}
        signer={signer}
      />
      <WrongNetwork open={wrongNetworkOpen} />

      <Grid container direction="column" alignItems="center" spacing={2}>
        <Grid item xs={12} className={classes.fullWidth}>
          <RemoveLiquidityField1
            activeField={true}
            value={field1Value}
            maxValue={liquidityTokens}
            maxWeiValue={liquidityTokensWei}
            onClick={() => setDialog1Open(true)}
            onChange={handleChange.field1}
            symbol={coin1.symbol !== undefined ? coin1.symbol : "Select"}
          />
        </Grid>

        <Grid item xs={12} className={classes.fullWidth}>
          <RemoveLiquidityField2
            activeField={true}
            onClick={() => setDialog2Open(true)}
            symbol={coin2.symbol !== undefined ? coin2.symbol : "Select"}
          />
        </Grid>
      </Grid>

      <Grid
        container
        direction="row"
        alignItems="center"
        justifyContent="center"
        spacing={12}
        className={classes.balance}
        xs={12}
      >
        <Grid
          container
          item
          direction="column"
          alignItems="center"
          className={classes.fullWidth}
        >
          {coin1.symbol && coin2.symbol && (
            <>
              <hr className={classes.hr} />
              <Grid container direction="row" alignItems="center" xs={12}>
                {/* LP tokens */}
                <Grid xs={1}></Grid>
                <Grid item xs={4} className={classes.leftSideBottomText}>
                  <Typography>LP Tokens Owned</Typography>
                </Grid>
                <Grid item xs={6} className={classes.rightSideBottomText}>
                  <Typography>
                    {formatReserve(liquidityTokens, "UNI-V2")}
                  </Typography>
                </Grid>
                <Grid xs={1}></Grid>
              </Grid>
              <hr className={classes.hr} />
              <Grid container direction="row" alignItems="center" xs={12}>
                {/* LP tokens */}
                <Grid xs={1}></Grid>
                <Grid item xs={4} className={classes.leftSideBottomText}>
                  <Typography>LP Tokens To Be Removed</Typography>
                </Grid>
                <Grid item xs={6} className={classes.rightSideBottomText}>
                  <Typography>
                    {formatBalance(tokensOut[0], "UNI-V2")}
                  </Typography>
                </Grid>
                <Grid xs={1}></Grid>
              </Grid>
              <Grid container direction="row" alignItems="center" xs={12}>
                {/* User's Unstaked Liquidity Tokens Display */}
                <Grid xs={1}></Grid>
                <Grid item xs={4} className={classes.leftSideBottomText}>
                  <Typography>You Will Receive</Typography>
                </Grid>
                <Grid item xs={6} className={classes.rightSideBottomText}>
                  <Typography>
                    {formatBalance(tokensOut[1], coin1.symbol)}
                    <img
                      src={"/assets/token/" + coin1.symbol + ".svg"}
                      className={classes.liquidityIcon}
                    ></img>
                  </Typography>
                  <Typography>
                    {formatBalance(tokensOut[2], coin2.symbol)}
                    <img
                      src={"/assets/token/" + coin2.symbol + ".svg"}
                      className={classes.liquidityIcon}
                    ></img>
                  </Typography>
                </Grid>
                <Grid xs={1}></Grid>
              </Grid>
              <hr className={classes.hr} />
            </>
          )}
        </Grid>
      </Grid>

      <LoadingButton
        loading={loading}
        valid={isButtonEnabled()}
        success={false}
        fail={false}
        onClick={remove}
      >
        <ArrowDownwardIcon className={classes.buttonIcon} />
        Remove
      </LoadingButton>
    </div>
  );
}

export default LiquidityRemover;
