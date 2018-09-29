import Axios, { AxiosInstance, AxiosResponse } from 'axios';
import { map, flatMap } from 'lodash';
import { create as createDebugger } from './debugger';
import crypto from 'crypto';
import { URL } from 'url';

function mapTicker(marketSymbol: string, tickerResponse: any): KunaTicker {
    return {
        market: marketSymbol,
        ...tickerResponse,
    };
}

export class KunaApiClient {

    private readonly debug;
    private readonly accessKey: string = undefined;
    private readonly secretKey: string = undefined;
    private readonly baseURL: string = 'https://kuna.io/api/v2';
    private readonly axiosClient: AxiosInstance;

    public constructor(accessKey?: string, secretKey?: string, baseURL?: string) {
        if (accessKey) {
            this.accessKey = accessKey;
        }
        if (secretKey) {
            this.secretKey = secretKey;
        }
        if (baseURL) {
            this.baseURL = baseURL;
        }

        this.axiosClient = Axios.create({
            baseURL: this.baseURL,
        });

        this.debug = createDebugger('api-client');
    }

    public async getTimeStamp(): Promise<number> {
        const { data }: AxiosResponse = await this.axiosClient.get("/timestamp");

        this.debug('getTimeStamp() ', data);
        return data;
    }

    public async getTicker(market: string): Promise<KunaTicker> {
        const { data }: AxiosResponse = await this.axiosClient.get(`/tickers/${market}`);

        this.debug('getTicker(' + market + ') ', data);

        return mapTicker(market, data.ticker);
    }

    public async getTickers(): Promise<KunaTicker[]> {
        const { data }: AxiosResponse = await this.axiosClient.get(`/tickers`);

        this.debug('getTickers() ', data);

        return map(data, (tickerResponse: any, market: string) => {
            return mapTicker(market, tickerResponse.ticker);
        });
    }

    public async getOrderBook(market: string): Promise<OrderBook> {
        const { data }: AxiosResponse = await this.axiosClient.get(`/depth?market=${market}`);

        this.debug('getOrderBook(${market)=', data);

        return data;
    }

    private mapTrade(value: object): Trade {
        return {
            id: +value["id"],
            price: +value["price"],
            volume: +value["volume"],
            funds: +value["funds"],
            market: value["market"],
            created_at: "" + value["created_at"],
            side: value["side"]
        };
    }

    public async getTrades(market: string): Promise<Trade[]> {
        const { data }: AxiosResponse = await this.axiosClient.get(`/trades?market=${market}`);

        this.debug('getTrades(${market)=', data);

        return flatMap(data, this.mapTrade);
    }

    /**
     * Signature is generated by an algorithm HEX(HMAC-SHA256("HTTP-verb|URI|params", secret_key))
     * HTTP-verb � GET or POST
     * URI � the query string without the domain
     * params � assorted parameters, including access_key and tonce, but without signature
     * secret_key � secret part of API-token
     * 
     * For example, a request for user bidding history:
     * HEX(
     * HMAC-SHA256(
        "GET|/api/v2/trades/my|access_key=dV6vEJe1CO&market=btcuah&tonce=1465850766246",
        "AYifzxC3Xo"
          )
       )
     */
    private _sign(httpVerb: string, methodUrl: string) {
        // @see https://nodejs.org/api/url.html#url_the_whatwg_url_api
        const u = new URL(this.baseURL + methodUrl);
        const queryString = `${httpVerb}|${u.pathname}` + u.search.replace('?', '|');
        // console.log('_sign=', queryString);
        return crypto.createHmac('sha256', this.secretKey)
            .update(queryString)
            .digest('hex');
    }

    private _getTime() {
        return new Date().getTime();
    }

    public async getUserInfo(): Promise<UserInfo> {

        var tonce = this._getTime();
        // var url = `GET|/api/v2/members/me|access_key=${this.accessKey}&tonce=${tonce}`;
        const url = `/members/me?access_key=${this.accessKey}&tonce=${tonce}`;
        var signature = this._sign('GET',url);
        this.debug('getUserInfo() url=', url, " signature=", signature);

        const { data }: AxiosResponse = await this.axiosClient.get(`/members/me?access_key=${this.accessKey}&tonce=${tonce}&signature=${signature}`);

        this.debug('getUserInfo data=', data);

        return data;
    }

    public async getUserTrades(market: string): Promise<Trade[]> {

        var tonce = this._getTime();
        //This is important to have market between access key and tonce!
        const methodUrl = `/trades/my?access_key=${this.accessKey}&market=${market}&tonce=${tonce}`;
        var signature = this._sign('GET',methodUrl);

        const { data }: AxiosResponse = await this.axiosClient.get(`${methodUrl}&signature=${signature}`);

        this.debug('getUserTrades data=', data);

        return flatMap(data, this.mapTrade);
    }

    private mapOrder(value: object): Order {
        return {
            id: +value["id"],
            side: value["side"],
            ord_type: value["ord_type"],
            price: +value["price"],
            avg_price: +value["avg_price"],
            state: value["state"],
            market: value["market"],
            created_at: value["created_at"],
            volume: +value["volume"],
            remaining_volume: +value["remaining_volume"],
            executed_volume: +value["executed_volume"],
            trades_count: +value["trades_count"]
        };
    }

    public async getUserOrders(market: string): Promise<Order[]> {

        var tonce = this._getTime();
        //keys should be sorted!
        const methodUrl = `/orders?access_key=${this.accessKey}&market=${market}&tonce=${tonce}`;
        var signature = this._sign('GET',methodUrl);

        const { data }: AxiosResponse = await this.axiosClient.get(`${methodUrl}&signature=${signature}`);

        this.debug('getUserTrades data=', data);

        return flatMap(data, this.mapOrder);
    }


    public async newOrder(side: string, volume: number, market: string, price: number): Promise<Order> {

        var tonce = this._getTime();
        //keys should be sorted!
        const methodUrl = `/orders?access_key=${this.accessKey}&market=${market}&price=${price}&side=${side}&tonce=${tonce}&volume=${volume}`;
        var signature = this._sign('POST',methodUrl);

        const { data }: AxiosResponse = await this.axiosClient.post(`${methodUrl}&signature=${signature}`);

        this.debug('newOrder data=', data);

        return this.mapOrder(data);
    }

    public async cancelOrder(id: number): Promise<Order> {

        var tonce = this._getTime();
        //keys should be sorted!
        const methodUrl = `/order/delete?access_key=${this.accessKey}&id=${id}&tonce=${tonce}`;
        var signature = this._sign('POST',methodUrl);

        const { data }: AxiosResponse = await this.axiosClient.post(`${methodUrl}&signature=${signature}`);

        this.debug('newOrder data=', data);

        return this.mapOrder(data);
    }

}
