import React from 'react';
import ReactDOM from 'react-dom';
import CONFIG from './config.js';
import Square from './square.js';
import SkillCard from './skill-card.js';
import './index.css';

const MODE = 'develop';

class Board extends React.Component {
    renderSquare(i) {
        return (
            <Square
             value={this.props.squares[i]}
             onClick={() => this.props.onClick(i)}
             enable={this.props.enableSquares.includes(i) ? 'enable' : ''}
             key={i}
            />
        );
    }

    render() {
        const list = [];
        for (let i = 0; i < 64; i++) {
            list.push(this.renderSquare(i));
        }

        return (
            <div className="board">
                {list}
            </div>
        );
    }
}

class Game extends React.Component {
    constructor(props) {
        super(props);

        const squares = Array(64).fill(null);
        squares[27] = CONFIG.whiteStone;
        squares[28] = CONFIG.blackStone;
        squares[35] = CONFIG.blackStone;
        squares[36] = CONFIG.whiteStone;

        this.state = {
            color: '',
            spName: '',
            isSpMode: false,
            canUseSp: true,
            xIsNext: true,
            squares: squares,
            history: [],
        };
    }
    
    webSocket(data) {
        if(MODE === 'develop') {
            this.setTurn();
            return;
        }

        const io = window.io;
        const socket = io.connect(window.location.host);

        if(!this.id) {
            const max = 99999;
            const min = 10000;
            this.id = Math.floor( Math.random() * (max + 1 - min) ) + min;
            socket.emit('login', this.id);
        }

        // サーバーに振り分けられた順番を設定する
        socket.on('setTurn', msg => this.setTurn(msg));

        // サーバーにデータ送信する
        socket.emit('message', JSON.stringify(data));

        // サーバーからデータを受信する
        socket.on('message', msg => this.recieve(msg));
    }

    setTurn(msg) {
        if(MODE === 'develop') {
            this.setState({
                color: 'black',
            });
            return
        }

        this.setState({
            color: msg[this.id],
        });
    }

    recieve(msg) {
        const data = JSON.parse(msg);
        this.setState({
            squares: data.squares,
            xIsNext: data.xIsNext,
            history: data.history,
        });
    }

    handleClick(i) {
        const squares = this.state.squares.slice();

        const turn = getTurn(this.state.xIsNext, squares);
        const next = turn !== CONFIG.blackStone;
        if(turn !== this.state.color) return;
        if(turn === null) return;
        
        if(this.state.isSpMode) return this.useSpecial(i);
        const processed = this.getReversedSquares(i);

        const history = this.state.history;
        history.push(squares);

        this.setState({
            squares: processed,
            xIsNext: next,
        });

        this.webSocket({
            id: this.id,
            squares: processed,
            xIsNext: next,
            history: history,
        });
    }

    getReversedSquares(i) {
        const squares = this.state.squares.slice();
        if(squares[i] !== null) return squares;

        const color = this.state.color;
        const reversibleSquares = getReversibleSquares(i, color, squares);
        reversibleSquares.forEach(e => squares[e] = color);

        return squares;
    }

    toggleMode() {
        if(this.state.canUseSp === false) return;

        const squares = this.state.squares.slice();
        const turn = getTurn(this.state.xIsNext, squares);
        if(turn !== this.state.color) return;
        if(turn === null) return;

        this.setState({
            isSpMode: !this.state.isSpMode,
        });
    }

    useSpecial(i) {
        let squares = this.state.squares.slice();
        let next = ''; 

        if(this.state.spName === 'reverse') {
            if(squares[i] === null) return;
            if(squares[i] === 'block') return;
            next = !this.state.xIsNext; 
            squares[i] = squares[i] === 'black' ? 'white' : 'black';
        }

        if(this.state.spName === 'double') {
            console.log(this.state.history.length);
            if(this.state.history.length < 5) return;
            next = this.state.xIsNext; 
            squares = this.getReversedSquares(i);
        }
        
        if(this.state.spName === 'block') {
            if(squares[i] !== null) return;
            next = !this.state.xIsNext; 
            squares[i] = 'block';
        }

        const history = this.state.history;
        history.push(squares);

        this.setState({
            squares: squares,
            xIsNext: next,
            isSpMode: false,
            canUseSp: false,
        });

        this.webSocket({
            id: this.id,
            squares: squares,
            xIsNext: next,
            history: history,
        });
    }

    onClickCharacter(spName) {
        const squares = this.state.squares.slice();

        this.setState({
            spName: spName,
        });

        this.webSocket({
            squares: squares,
            xIsNext: true,
        });
    }

    render() {
        if(!this.state.spName) {
            return (
                <div className="entry">
                    <header className="entry__header">
                        <h1 className="entry__title">
                            スキルを選んでください。
                        </h1>
                    </header>
                    <SkillCard
                     skill="reverse"
                     onClick={() => this.onClickCharacter("reverse")}
                    />
                    <SkillCard
                     skill="double"
                     onClick={() => this.onClickCharacter("double")}
                    />
                    <SkillCard 
                     skill="block" 
                     onClick={() => this.onClickCharacter("block")}
                    />
                </div>
            );
        }

        if(!this.state.color) {
            return (
                <Dialog
                 message="対戦相手を探しています..."
                 kind="waiting"
                />
            );
        }

        const squares = this.state.squares.slice();
        const turn = getTurn(this.state.xIsNext, squares);

        let enableSquares = getEnableSquares(this.state.color, squares);
        if(this.state.color !== turn) enableSquares = [];

        const p1 = this.state.color;
        const p2 = p1 === 'black' ? 'white' : 'black';
        const count = getStoneCount(squares);

        if(MODE === 'develop') {
            return (
                <Result
                 p1={p1}
                 p2={p2}
                 count={count}
                 history={this.state.history}
                />
            );
        }

        return (
            <div className="game">

                <div className="game-info p2">
                    <div className="name">Player2</div>
                    <div className="count">
                        <Stone
                         value={p2}
                         count={count[p2]}
                        />
                    </div>
                </div>

                <div className="game-board">
                    <div className="board-mark">
                        <div className="mark lt"/>
                        <div className="mark lb"/>
                        <div className="mark rt"/>
                        <div className="mark rb"/>
                        <div/>
                    </div>

                    <Board 
                     squares={squares}
                     enableSquares={enableSquares}
                     onClick={i => this.handleClick(i)}
                    />
                </div>

                <div className="game-info p1">
                    <div className="count">
                        <Stone
                         value={p1}
                         count={count[p1]}
                        />
                    </div>
                    <div className="name">Player1</div>
                    <Toggle
                     mode={this.state.isSpMode ? 'special' : 'normal'}
                     value="Skill"
                     onClick={() => this.toggleMode()}
                    />
                </div>
            </div>
        );
    }
}

function Result(props) {
    const player1 = props.p1;
    const player2 = props.p2;
    const squares = props.history.slice(-1);
    const result = calculateResult(squares, player1);

    return (
        <div className="result">
            <div className="result__message">
                {result}
            </div>
            <div className={`result__${player1}`}>
                <div className="result__description">
                    <span className="result__name">Player1</span>
                    <Stone value={player1} />
                    <span className="result__count">{`x${props.count[player1]}`}</span>
                </div>
            </div>
            <div className={`result__${player2}`}>
                <div className="result__description">
                    <span className="result__name">Player2</span>
                    <Stone value={player2} />
                    <span className="result__count">{`x${props.count[player2]}`}</span>
                </div>
            </div>
            <button className="result__button" onClick={() => window.location.reload()}>OK</button>
        </div>
    );
}

function Stone(props) {
    return (
        <div className={`stone ${props.value}`}>
            {props.count}
        </div>
    );
}

function Dialog(props) {
    return (
        <div className={`dialog ${props.kind} ${props.view}`}>
            {props.message}
        </div>
    );
}

function Toggle(props) {
    return (
        <button className={`toggle ${props.mode}`} onClick={props.onClick}>
            {props.value}
        </button>
    );
}

function getTurn(isBlackTurn, squares) {
    let enableSquares = [];
    const first  = isBlackTurn ? CONFIG.blackStone : CONFIG.whiteStone;
    enableSquares = getEnableSquares(first, squares);
    if(enableSquares.length > 0) return first; 

    const second = !isBlackTurn ? CONFIG.blackStone : CONFIG.whiteStone;
    enableSquares = getEnableSquares(second, squares);
    if(enableSquares.length > 0) return second; 

    return null;
}

function calculateResult(squares, color) {
    const black = CONFIG.blackStone;
    const white = CONFIG.whiteStone;

    const stoneCount = getStoneCount(squares);

    if(stoneCount.black === stoneCount.white) return 'Draw';

    let winner = (stoneCount.black > stoneCount.white) ? black : white;

    return winner === color ? 'Win' : 'Lose';
}

function getStoneCount(squares, stone) {
    const blackStone = CONFIG.blackStone;
    const whiteStone = CONFIG.whiteStone;
    let blackStoneCount = 0;
    let whiteStoneCount = 0;
    for (let i = 0; i < squares.length; i++) {
        if(squares[i] === null) continue;
        if(squares[i] === blackStone) blackStoneCount++;
        if(squares[i] === whiteStone) whiteStoneCount++;
    }

    const count = {
        black: blackStoneCount,
        white: whiteStoneCount
    };

    if(!stone) {
        return count;
    }

    return count[stone];
} 

function getEnableSquares(stone, squares) {
    let enableSquares = [];
    let reversibleSquares = [];
    for (let i = 0; i < squares.length; i++) {
        if(squares[i] !== null) continue;
        reversibleSquares = getReversibleSquares(i, stone, squares);
        if(reversibleSquares.length === 0) continue;
        enableSquares = enableSquares.concat(reversibleSquares);
    }

    return enableSquares.filter(e => squares[e] === null);
}

function getReversibleSquares(i, stone, squares) {
    let result = [];
    let tmp = [];
    let count = 0;
    let current = 0;
    const directions = getDirections();

    for(const k of Object.keys(directions)) {
        count = 0;
        current = i;
        tmp = [];

        while(true) {
            if(count === 0) {
                const next = current + directions[k];
                if(squares[next] === null)  break;
                if(squares[next] === stone) break;
            }
        
            if(count !== 0) {
                if(squares[current] === null) break;
            }

            if(squares[current] === 'block') break;

            if(squares[current] === stone) {
                result = result.concat(tmp);
                break;
            }

            if(isLimit(current, k) === true) break;
            
            count++;
            tmp.push(current);
            current += directions[k];
        }
    }

    return result;
}

function isLimit(i, d) {
    const limit = getLimit();
    return limit[d].indexOf(i) !== -1;
}

function getDirections() {
    return {
        tl: -9,
        t:  -8,
        tr: -7,
        l:  -1,
        r:  1,
        bl: 7,
        b:  8,
        br: 9
    };
}

function getLimit() {
    const t = [0, 1, 2, 3, 4, 5, 6, 7];
    const l = [0, 8, 16, 24, 32, 40, 48, 56];
    const r = [7, 15, 23, 31, 39, 47, 55, 63];
    const b = [56, 57, 58, 59, 60, 61, 62, 63];

    const tl = l.concat(t);
    const tr = r.concat(t);
    const bl = l.concat(b);
    const br = r.concat(b);

    return {
        tl: tl,
        t:  t,
        tr: tr,
        l:  l,
        r:  r,
        bl: bl,
        b:  b,
        br: br
    };
}

// ========================================

ReactDOM.render(
    <Game />,
    document.getElementById('root')
);

