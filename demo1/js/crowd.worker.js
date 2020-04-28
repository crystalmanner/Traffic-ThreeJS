/**   _   _____ _   _   
*    | | |_   _| |_| |
*    | |_ _| | |  _  |
*    |___|_|_| |_| |_| 2017
*    @author lo-th / https://github.com/lo-th/
*    @author Engine Samuel Girardin / http://www.visualiser.fr/
*
*    CROWD worker
*
*/

'use strict';

var M = {}
var RAND_MAX = 32767;
var RVO_EPSILON = 0.0001;
M.rand = function ( low, high ) { return low + Math.random() * ( high - low ); };
M.randInt = function ( low, high ) { return low + Math.floor( Math.random() * ( high - low + 1 ) ); };
M.randCC =  function () { return M.randInt( 0, RAND_MAX ) }
//var useTransferrable = false;
var timer, step, timestep;
//var ar = null;

var Gr, GrMax;

self.onmessage = function ( e ) {

    var data = e.data;
    var m = data.m;
    var o = data.o;

    // ------- buffer data
    if( data.Gr ) Gr = data.Gr;

    switch( m ){

        case 'init': crowd.init( data ); break;
        case 'step': crowd.step( data ); break;
        case 'reset': crowd.reset( data ); break;

        case 'set': crowd.set( o ); break;

        case 'add': crowd.addAgent( o ); break;
        case 'obstacle': crowd.addObstacle( o ); break;
        case 'way': crowd.addWay( o ); break;
        case 'speed': crowd.setSpeed( o ); break;
        case 'goal': crowd.setGoal( o ); break;

        case 'stop': crowd.stop( data ); break;
        case 'play': crowd.play( data ); break;

        /*case 'start':
            useTransferrable = data.useTransferrable;
            ar = data.ar;
            if( useTransferrable ) timer = setTimeout( crowd.update, step );
            else timer = setInterval( crowd.update, step ); 
        break;
        case 'run': 
            ar = data.ar;
            timer = setTimeout( crowd.update, step ); 
        break;*/
        
    }
}


/*this.post = function ( o, buffer ){

    if( useTransferrable ) self.postMessage( o, buffer );
    else self.postMessage( o );

}*/


// crowd


//const torad = 0.0174532925199432957;
//const todeg = 57.295779513082320876;

var CROWD;

var Maxi = 100;
var GrMax = Maxi * 5;
var max = 6000;
var reus = 2;

var isBuffer = false;

var patchVelocity = false;
var iteration = 1;

// 15 neighborDist    The default maximum distance (center point to center point) to other agents a new agent
//                    takes into account in the navigation. The larger this number, the longer he running
//                    time of the simulation. If the number is too low, the simulation will not be safe. Must be non-negative.
// 10 maxNeighbors    The default maximum number of other agents a new agent takes into account in the
//                    navigation. The larger this number, the longer the running time of the simulation.
//                    If the number is too low, the simulation will not be safe.
// 10 timeHorizon     The default minimal amount of time for which a new agent's velocities that are computed
//                    by the simulation are safe with respect to other agents. The larger this number, the
//                    sooner an agent will respond to the presence  of other agents, but the less freedom the
//                    agent has in choosing its velocities. Must be positive.
// 10 timeHorizonObst The default minimal amount of time for which  a new agent's velocities that are computed
//                    by the simulation are safe with respect to obstacles. The larger this number, the
//                    sooner an agent will respond to the presence of obstacles, but the less freedom the agent
//                    has in choosing its velocities. Must be positive.


var precision = [ 10, 15, 10, 10 ];




var dataReus;
var dataHeap;

var agents = [];
var obstacles = [];
var way = [];

/*function initARRAY(){

    ar = new Float32Array( 100 * 5 );

}*/

var crowd = {

    init: function ( o ) {

        isBuffer = o.isBuffer || false;

        if( !CROWD ) importScripts( o.blob );

        iteration = o.iteration || 1;

        

        Maxi = o.Maxi || 100;
        GrMax = Maxi * 5;
        max = Maxi * 3 ;

        this.initEngine();

        //

        //CROWD.setTimeStep( o.timeStep || 0.016 );//0.3?

        //
        
        //if( !isBuffer ) Gr = new Float32Array( GrMax );

        //initARRAY();

        self.postMessage( { m:'init' } );

    },

    initEngine: function (){

        if(dataHeap) _free( dataHeap.byteOffset );
        if(dataReus) _free( dataReus.byteOffset );

        // init

        CROWD.init();

        // dataHeap

        var data = new Float32Array( max );
        var nDataBytes = max * data.BYTES_PER_ELEMENT;
        var dataPtr = _malloc( nDataBytes );

        dataHeap = new Uint8Array( Module.HEAPU8.buffer, dataPtr, nDataBytes );
        dataHeap.set( new Uint8Array( data.buffer ) );

        CROWD.allocateMem_X_Y_RAD( dataHeap.byteOffset, max );

        // dataReus

        var data2 = new Float32Array( reus );
        var nDataBytes2 = reus * data2.BYTES_PER_ELEMENT;
        var dataPtr2 = _malloc( nDataBytes2 );

        dataReus = new Uint8Array( Module.HEAPU8.buffer, dataPtr2, nDataBytes2 );
        dataReus.set( new Uint8Array( data2.buffer ));

        CROWD.allocateMemResusable( dataReus.byteOffset, reus );

        CROWD.setTimeStep( 0.3 );

    },

    set: function ( o ) {

        o = o || {};

        var timeStep = o.timeStep !== undefined ? o.timeStep : 0.016;
        CROWD.setTimeStep( o.forceStep || timeStep );

        iteration = o.iteration || 1;

        patchVelocity = o.patchVelocity || false;

        precision = o.precision || [ 10, 15, 10, 10 ];

    },

    step: function () {

        if(patchVelocity) setPreferredVelocities( true )

        CROWD.run( iteration );
        CROWD.X_Y_RAD = new Float32Array( dataHeap.buffer, dataHeap.byteOffset, max );

        stepAgents();

        if( isBuffer ) self.postMessage({ m:'step', Gr:Gr },[ Gr.buffer ]);
        else self.postMessage( { m:'step', Gr:Gr } );

    },

    /*setTime: function ( t ){

        step = 1000 / t;
        timestep = step * 0.001;

    },*/

    reset: function () {

        CROWD.deleteCrowd();

        //while( agents.length > 0 ) agents.pop().remove();
        //while( obstacles.length > 0 ) obstacles.pop().remove();
        //while( way.length > 0 ) way.pop().remove();
        agents = [];
        obstacles = [];
        way = [];
        //console.log(agents)
      
        

        this.initEngine();
        //CROWD.init();

        if( !isBuffer ) Gr = new Float32Array( GrMax );

        self.postMessage({ m:'start' });

    },

    

    addWay: function ( o ){

        CROWD.addWayPoint( o.x, o.z );
        CROWD.recomputeRoadmap();

    },

    stop: function( o ){

        agents[ o.id ].stop();

    },

    play: function( o ){

        agents[ o.id ].play();

    },

    setSpeed:function( o ){

        CROWD.setAgentMaxSpeed( o.id, o.speed );
        
    },

    setGoal:function( o ){

        var i = agents.length, a;

        if( o.id !== undefined ){
            agents[o.id].addGoal( o );
        }


        /*if( o.group !== undefined ){
            //var i = agents.length, a;
            while(i--){
                a = agents[i]
                if( a.group === o.group ) a.addGoal( o );
            }
        } else {
            CROWD.addAgentsGoal( o.x, o.z );
        }*/

        
        CROWD.recomputeRoadmap();

    },

    addObstacle: function ( o ) {

        var obstacle = new crowd.Obstacle( o );
        obstacles.push( obstacle );

    },

    addAgent: function ( o ) {

        var agent = new crowd.Agent( o );
        

    },

    removeAgent: function ( id ) {
        
        agents[id].remove();
        agents.splice( id, 1 );

        var i = agents.length;
        while( i-- ){
            agents[i].setId( i );
        }

    },

    setIteration: function ( v ) {

        iteration = v;

    },

    setPrecision: function ( v ) {



        switch ( v ) {

            case 1: precision = [ 10, 15, 10, 10 ]; break;
            case 2: precision = [ 100, 200, 50, 30 ]; break;
            case 3: precision = [ 100, 100, 100, 100 ]; break;

        }

        var i = agents.length, n, agent;
        while( i-- ){
            agents[i].setPrecision();
        }

    },

}


function setPreferredVelocities( full ) {

    agents.forEach( function ( b, id ) {
         b.correctVelocity( full );
    });

}

function stepAgents( ) {

    var XYR = CROWD.X_Y_RAD;

    agents.forEach( function ( b, id ) {

        //b.correctVelocity( true );

        var n = id*5;
        var m = id*3;

        
        // position
        b.setPosition( XYR[ m ], XYR[ m + 1 ] );
        Gr[ n + 1 ] = b.position.x;
        Gr[ n + 2 ] = b.position.y;

        // speed
        Gr[ n ] = b.getSpeed2();

        
        // rotation
        //b.orientation = XYR[ m + 2 ]//Gr[ n + 3 ] = XYR[ m + 2 ];
        Gr[ n + 3 ] = XYR[ m + 2 ];
        
         //console.log('agent', b.position.x)
        // Gr[ n + 3 ] = b.getOrientation();
        Gr[ n + 4 ] = b.getDistanceToGoal();

        
   
    });

};









// -----------------------------------
// Agent
// -----------------------------------

crowd.Agent = function ( o ) {

    this.id = agents.length;

    this.radius = o.radius || 4;
    this.speed = o.speed !== undefined ? o.speed : 1;
    this.isSelected = false;

    this.goal = new crowd.Vec2( o.gx || 0, o.gz || 0 );

    this.position = new crowd.Vec2( o.x || 0, o.z || 0 );
    this.oldPos = new crowd.Vec2( o.x || 0, o.z || 0 );

    this.velocity = new crowd.Vec2();
    this.prevVelocity = new crowd.Vec2();

    this.useRoadMap = o.useRoadMap || false;

    this.goalVector = new crowd.Vec2();
    this.tmpA = new crowd.Vec2();

    //this.orientation = 0;

    this.group = o.group || 0;


    this.currentSpeed = 0;


    CROWD.addAgent( this.position.x, this.position.y );

    CROWD.setAgentRadius( this.id, this.radius );
    CROWD.setAgentMaxSpeed( this.id, this.speed );
    CROWD.setAgentUseRoadMap( this.id, this.useRoadMap ? 1:0 );


    //console.log(this.id, o.radius, this.useRoadMap)

    this.setPrecision();


    agents.push( this );

}

crowd.Agent.prototype = {

    constructor: crowd.Agent,

    remove: function () {

        CROWD.removeAgent( this.id );

    },

    stop: function(){

        CROWD.setAgentMaxSpeed( this.id, 0 );

    },

    play: function(){

        CROWD.setAgentMaxSpeed( this.id, this.speed );

    },

    correctVelocity: function ( full ) {

        // Set the preferred velocity to be a vector of unit magnitude (speed) in the direction of the goal.
        this.goalVector.copy( this.goal )
        //CROWD.getAgentPosition(this.id, this.tmpP)
        this.goalVector.sub( this.position );

        if( this.goalVector.length() > 1.0 ) this.goalVector.normalize();

        if(full){
            // Perturb a little to avoid deadlocks due to perfect symmetry
            var angle = M.randCC() * 2.0 * Math.PI / RAND_MAX;
            var dist = M.randCC() * 0.0001 / RAND_MAX;

            this.tmpA.set( Math.cos(angle), Math.sin(angle) ).mul(dist)

            
            this.goalVector.add( this.tmpA )
        }

        CROWD.setAgentPrefVelocity( this.id, this.goalVector.x, this.goalVector.y );

    },

    setPosition: function ( x, y ) {

        this.oldPos.copy( this.position );
        this.position.set( x, y );

    },

    getSpeed2: function (){

        //this.getVelocity();

        this.currentSpeed = this.oldPos.distanceTo( this.position ) * 9.8;
        if( this.currentSpeed < 0.01 ) this.currentSpeed = 0;
        return this.currentSpeed;

    },

    getSpeed: function (){

        this.getVelocity();

        this.currentSpeed = this.velocity.length(); //Math.floor( this.oldPos.distanceTo( this.position )*10 );
        return this.currentSpeed;

    },

    setPrecision: function ( v ) {

        v = v || precision;

        CROWD.setAgentMaxNeighbors( this.id, v[0] );
        CROWD.setAgentNeighborDist( this.id, v[1] );
        CROWD.setAgentTimeHorizon(  this.id, v[2] );
        CROWD.setAgentTimeHorizonObst( this.id, v[3] );

    },

    addGoal: function ( o ) {

        this.goal.set( o.x, o.z );
        CROWD.addAgentGoal( this.id, o.x, o.z );

    },

    getDistanceToGoal: function () {

        return this.position.distanceTo( this.goal );

    },

    /*getOrientation: function () {

        this.getVelocity();

        if(this.currentSpeed>1) this.orientation = this.lerp( this.orientation, this.getVelocity().orient(), 0.25 );
        return this.orientation;

    },*/

    getPrefVelocity : function () {

        CROWD.getAgentPrefVelocity( this.id );
        var a = new Float32Array( dataReus.buffer, dataReus.byteOffset, reus );
        this.prevVelocity.set( a[0], a[1] );
        return this.prevVelocity;

    },

    getVelocity : function () {

        CROWD.getAgentVelocity( this.id );
        var a = new Float32Array( dataReus.buffer, dataReus.byteOffset, reus );
        this.velocity.set( a[0], a[1] );
        return this.velocity;

    },

    lerp : function (a, b, percent) { 

        return a + (b - a) * percent;

    },

    setId : function ( id ) {

        this.id = id;

    },


    getId : function () {

        return this.id;

    },


}

// Obstacle

crowd.Obstacle = function ( o ) {

    this.id = obstacles.length;

    this.dataHeap = null;
    this.data = null;

    o.type = o.type || 'box';
    if(o.type === 'box') this.addByBoundingBox(o);
    else this.addByClosedPolygon(o);
    


}

crowd.Obstacle.prototype = {

    constructor: crowd.Obstacle,

    addByBoundingBox : function ( o ) {
        var pos = o.pos || [0,0,0];
        var size = o.size || [32,32,32];

        var x = pos[0];
        var y = pos[2];
        var mw = size[0]*0.5;
        var mh = size[2]*0.5;

        var r = o.r || 0;

        var cos = Math.cos(o.r);
        var sin = Math.sin(o.r);

        var px = 0;
        var py = 0;

        var vx = 0;
        var vy = 0;

        var arr = []

        for(var i=0; i<4; i++){

            if(i===0) {px = mw; py = mh;}
            if(i===1) {px = -mw; py = mh;}
            if(i===2) {px = -mw; py = -mh;}
            if(i===3) {px = mw; py = -mh;}

            vx = (cos * px) + (sin * py) + x,
            vy = (cos * py) - (sin * px) + y;

            arr.push(vx, vy)

        }
        
        this.data = new Float32Array(arr);
      
        this.allocateMem();
        this.addToSimulation();

        _free( this.dataHeap.byteOffset );

        //console.log('box added', this.data)
    },
    addByClosedPolygon : function ( o ) {
        var index = 0;
        this.data = new Float32Array( o.arr.length * 2);
        for (var i = 0; i < o.arr.length; i++) {
            this.data[index++] = o.arr[i].x;
            this.data[index++] = o.arr[i].y;
        }

        this.allocateMem();
        this.addToSimulation();
        _free(this.dataHeap.byteOffset);
    },
    rebuild : function () {
        this.allocateMem();
        //this.addToSimulation();
        _free( this.dataHeap.byteOffset );
    },
    remove : function ( id ) {
       // if (this.mesh) this.mesh.dispose();
        //Obstacle.ObstaclesOrder.splice(index, 1);
        //Obstacle.NumObstacles--;
    },
    addToSimulation : function () {

        CROWD.addObstacle( this.dataHeap.byteOffset, this.data.length );

        CROWD.processObstacles();
        CROWD.recomputeRoadmap();
        //BABYLON.CrowdPlugin.addObstacle(this.dataHeap.byteOffset, this.data.length);
    },

    allocateMem : function () {

        var nDataBytes = this.data.length * this.data.BYTES_PER_ELEMENT;
        var dataPtr = _malloc( nDataBytes );
        this.dataHeap = new Uint8Array(Module.HEAPU8.buffer, dataPtr, nDataBytes);
        this.dataHeap.set(new Uint8Array(this.data.buffer));

    }

}



// WayPoint

crowd.WayPoint = function ( x, y ) {

    CROWD.addWayPoint( x, y );

}

crowd.WayPoint.prototype = {

    constructor: crowd.WayPoint,

    remove : function ( id ) {
    },

}




// Vector 2

crowd.Vec2 = function( x, y ) {

    this.x = x || 0;
    this.y = y || 0;

}

crowd.Vec2.prototype = {

    constructor: crowd.Vec2,

    set: function ( x, y ){

        this.x = x;
        this.y = y;
        return this;

    },

    length: function () {

        return Math.sqrt( this.x * this.x + this.y * this.y );

    },

    normalize: function () {

        var norm = this.length();
        this.x /= norm;
        this.y /= norm;
        return this;

    },

    lerp: function ( v, alpha ) {

        this.x += ( v.x - this.x ) * alpha;
        this.y += ( v.y - this.y ) * alpha;
        return this;

    },

    angle: function(v) {

        return Math.atan2( v.y - this.y, v.x - this.x );

    },

    orient: function(){

        return Math.atan2( this.x , this.y );

    },

    distanceTo: function( v ) {

        var dx = this.x - v.x;
        var dy = this.y - v.y;
        return Math.sqrt( dx * dx + dy * dy );

    },

    copy: function( v ){

        this.x = v.x;
        this.y = v.y;

    },

    sub:function( v ){

        this.x -= v.x;
        this.y -= v.y;

    },

    mul: function ( s ) {

        this.x *= s;
        this.y *= s;
        return this;

    },

    add: function( n ) {

        this.x += n.x;
        this.y += n.y;
        return this;

    },

}