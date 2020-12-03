import * as React from "react";
import { message, Tabs } from "antd";
import classNames from "classnames";
import { v4 as uuidv4 } from "uuid";
import { Rtm } from "../../apiMiddleware/Rtm";
import { ChatMessages } from "./ChatMessages";
import { RTMessage } from "./ChatMessage";
import { ChatUsers } from "./ChatUsers";
import { RTMUser } from "./ChatUser";
import "./ChatPanel.less";
import { generateAvatar } from "../../utils/generateAvatar";

export interface ChatPanelProps
    extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    userId: string;
    channelId: string;
    isRoomOwner: boolean;
}

export interface ChatPanelState {
    messages: RTMessage[];
    users: RTMUser[];
}

export class ChatPanel extends React.Component<ChatPanelProps, ChatPanelState> {
    private rtm = new Rtm();

    state: ChatPanelState = {
        messages: [],
        users: [],
    };

    async componentDidMount() {
        const { userId, channelId } = this.props;
        const channel = await this.rtm.init(userId, channelId);
        channel.on("ChannelMessage", (msg, senderId) => {
            if (msg.messageType === "TEXT") {
                this.addMessage(msg.text, senderId);
            }
        });

        const members = await channel.getMembers();
        this.setState({
            users: members.map(uid => ({
                id: uid,
                // @TODO 等待登陆系统接入
                avatar: generateAvatar(uid),
                name: "",
            })),
        });
        channel.on("MemberJoined", uid => {
            this.setState(state => ({
                users: [
                    ...state.users,
                    {
                        id: uid,
                        // @TODO 等待登陆系统接入
                        avatar: generateAvatar(uid),
                        name: "",
                    },
                ],
            }));
        });
        channel.on("MemberLeft", uid => {
            this.setState(state => ({
                users: state.users.filter(user => user.id !== uid),
            }));
        });
    }

    componentWillUnmount() {
        this.rtm.destroy();
    }

    render() {
        const { isRoomOwner, userId, channelId, className, ...restProps } = this.props;
        const { messages, users } = this.state;
        return (
            <div {...restProps} className={classNames("chat-panel", className)}>
                <Tabs defaultActiveKey="messages" tabBarGutter={0}>
                    <Tabs.TabPane tab="消息列表" key="messages">
                        <ChatMessages
                            userId={userId}
                            isRoomOwner={isRoomOwner}
                            messages={messages}
                            onMessageSend={this.onMessageSend}
                        />
                    </Tabs.TabPane>
                    <Tabs.TabPane tab="用户列表" key="users">
                        <ChatUsers userId={userId} users={users} />
                    </Tabs.TabPane>
                </Tabs>
            </div>
        );
    }

    private onMessageSend = async (text: string): Promise<void> => {
        await this.rtm.channel?.sendMessage({ text }, { enableHistoricalMessaging: true });
        this.addMessage(text, this.props.userId);
    };

    private addMessage = (text: string, senderId: string): void => {
        this.setState(state => {
            const timestamp = Date.now();
            const messages = [...state.messages];
            let insertPoint = 0;
            while (insertPoint < messages.length && messages[insertPoint].timestamp <= timestamp) {
                insertPoint++;
            }
            messages.splice(insertPoint, 0, {
                uuid: uuidv4(),
                timestamp,
                text: text,
                userId: senderId,
            });
            this.setState({ messages });
        });
    };
}

export default ChatPanel;
