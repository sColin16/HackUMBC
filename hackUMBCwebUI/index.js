let isHandlerDragging = false;
let MIN_WIDTH_MAIN_PANEL = 400;
let rooms = [];
//Thanks to https://htmldom.dev/create-resizable-split-views/ for the resizing script
document.addEventListener('DOMContentLoaded', function() {
    let videos = document.getElementsByClassName("videoContainer")
    Array.prototype.forEach.call(videos, videoScreen =>{
        makeElementDraggable(videoScreen);
    });
        // Query the element
    const resizer = document.getElementById('panelDivider');
    const leftSide = resizer.previousElementSibling;
    const rightSide = resizer.nextElementSibling;

    // The current position of mouse
    let mouseX = 0;
    let mouseY = 0;
    let leftWidth = 0;

    // Handle the mousedown event
    // that's triggered when user drags the resizer
    const mouseDownHandler = function(e) {
        // Get the current mouse position
        mouseX = e.clientX;
        mouseY = e.clientY;
        leftWidth = leftSide.getBoundingClientRect().width;

        // Attach the listeners to `document`
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function(e) {
        // How far the mouse has been moved
        const dx = e.clientX - mouseX;
        const dy = e.clientY - mouseY;

        const newLeftWidth = (leftWidth + dx) * 100 / resizer.parentNode.getBoundingClientRect().width;
        leftSide.style.width = `${newLeftWidth}%`;

        resizer.style.cursor = 'col-resize';
        document.body.style.cursor = 'col-resize';

        leftSide.style.userSelect = 'none';
        leftSide.style.pointerEvents = 'none';

        rightSide.style.userSelect = 'none';
        rightSide.style.pointerEvents = 'none';
    };

    const mouseUpHandler = function() {
        resizer.style.removeProperty('cursor');
        document.body.style.removeProperty('cursor');

        leftSide.style.removeProperty('user-select');
        leftSide.style.removeProperty('pointer-events');

        rightSide.style.removeProperty('user-select');
        rightSide.style.removeProperty('pointer-events');
        // Remove the handlers of `mousemove` and `mouseup`
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    // Attach the handler
    resizer.addEventListener('mousedown', mouseDownHandler);
});

function addNewRoom(){
    let roomContainer = document.getElementById('roomContainer')
    let newRoom = new Room(rooms.length, null)

    newRoom.makeDomElement();
    newRoom.domElement.onmouseover = function(){
        console.log("mouse is over");
        newRoom.isMousedOver = true;
    }
    newRoom.domElement.onmouseleave = function(){
        newRoom.isMousedOver = false;
    }
    rooms.push(newRoom);
    roomContainer.appendChild(newRoom.domElement);
}
//ROOM OBJECT
function Room(roomID, peopleList){
    this.id = roomID;
    this.peopleList = peopleList;
    this.isMousedOver = false;
    this.makeDomElement = function() {
        let roomElement = document.createElement("div");
        roomElement.classList.add('room');
        this.domElement = roomElement;
    };
    this.domElement = null;
}

function inRoom(){
    let out = false;
    rooms.forEach(room =>{
        console.log(room);
        if(room.isMousedOver){
            console.log("in the room kinda")
            out = true;
        }
    });
    return out;
}
function getRoomDiv(){
    let out = null
    rooms.forEach(room =>{
        if(room.isMousedOver){
            console.log(room.isMousedOver);
            out = room.domElement;
        }
    });
    return out;
}

function makeElementDraggable(elem) {
    let pos1 = 0, pos2 = 0, initialMouseX = 0, initialMouseY = 0;
    elem.onmousedown = dragMouseDown;
    function dragMouseDown(e) {
        elem.style.pointerEvents = "none";
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        let topPos = elem.getBoundingClientRect().top
        let leftPos = elem.getBoundingClientRect().left
        pos1 = initialMouseX - e.clientX;
        pos2 = initialMouseY - e.clientY;
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;
        // set the element's new position:
        elem.style.position = "absolute"
        elem.style.top = (topPos - pos2) + "px";
        elem.style.left =(leftPos - pos1) + "px";
    }

    function closeDragElement(e) {
        e = e || window.event;
        e.preventDefault();
        if(inRoom()){
            console.log("IN ROOM!")
            let destination = getRoomDiv()
            destination.appendChild(elem);
        }
        //else go back to before
        elem.style.position = "relative"
        elem.style.top =  0;
        elem.style.left = 0;

        /* stop moving when mouse button is released:*/
        elem.style.pointerEvents = "auto";
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

